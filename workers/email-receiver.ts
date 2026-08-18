import { Env } from '../types'
import { drizzle } from 'drizzle-orm/d1'
import { messages, emails, webhooks } from '../app/lib/schema'
import { eq, sql } from 'drizzle-orm'
import PostalMime from 'postal-mime'
import { WEBHOOK_CONFIG } from '../app/config/webhook'
import { EmailMessage } from '../app/lib/webhook'

const MAX_STORED_BODY_BYTES = 512_000

export const resolveForwardDestination = (
  recipient: string,
  env: Pick<Env, 'FORWARD_TO_EMAIL' | 'FORWARD_EMAILS'>,
) => {
  const destination = env.FORWARD_TO_EMAIL?.trim()
  if (!destination) return null

  const allowedRecipients = new Set(
    (env.FORWARD_EMAILS || '')
      .split(',')
      .map(address => address.trim().toLowerCase())
      .filter(Boolean),
  )

  return allowedRecipients.has(recipient.trim().toLowerCase())
    ? destination
    : null
}

const truncateUtf8 = (value: string, maxBytes: number) => {
  const encoded = new TextEncoder().encode(value)
  if (encoded.byteLength <= maxBytes) return value

  return new TextDecoder().decode(encoded.slice(0, maxBytes))
}

const handleEmail = async (message: ForwardableEmailMessage, env: Env) => {
  const db = drizzle(env.DB, { schema: { messages, emails, webhooks } })

  const parsedMessage = await PostalMime.parse(message.raw)

  try {
    const targetEmail = await db.query.emails.findFirst({
      where: eq(sql`LOWER(${emails.address})`, message.to.toLowerCase())
    })

    if (!targetEmail) {
      console.error(`Email not found: ${message.to}`)
      return
    }

    const savedMessage = await db.insert(messages).values({
      emailId: targetEmail.id,
      fromAddress: message.from,
      subject: (parsedMessage.subject || '(无主题)').slice(0, 500),
      content: truncateUtf8(parsedMessage.text || '', MAX_STORED_BODY_BYTES),
      html: truncateUtf8(parsedMessage.html || '', MAX_STORED_BODY_BYTES),
      type: 'received',
    }).returning().get()

    const forwardDestination = resolveForwardDestination(targetEmail.address, env)
    if (forwardDestination) {
      try {
        await message.forward(forwardDestination)
      } catch (error) {
        console.error('Failed to forward approved email:', error)
      }
    }

    const webhook = await db.query.webhooks.findFirst({
      where: eq(webhooks.userId, targetEmail!.userId!)
    })

    if (webhook?.enabled) {
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': WEBHOOK_CONFIG.EVENTS.NEW_MESSAGE
          },
          body: JSON.stringify({
            emailId: targetEmail.id,
            messageId: savedMessage.id,
            fromAddress: savedMessage.fromAddress,
            subject: savedMessage.subject,
            content: savedMessage.content,
            html: savedMessage.html,
            receivedAt: savedMessage.receivedAt.toISOString(),
            toAddress: targetEmail.address
          } as EmailMessage)
        })
      } catch (error) {
        console.error('Failed to send webhook:', error)
      }
    }

    console.log(`Email processed: ${parsedMessage.subject}`)
  } catch (error) {
    console.error('Failed to process email:', error)
  }
}

const worker = {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    await handleEmail(message, env)
  }
}

export default worker
