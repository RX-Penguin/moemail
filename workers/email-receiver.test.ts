import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveForwardDestination } from './email-receiver'

const env = {
  FORWARD_TO_EMAIL: 'spenguin725@gmail.com',
  FORWARD_EMAILS: [
    'spenguin01@xyslh.cc.cd',
    'spenguin02@xyslh.cc.cd',
    'spenguin03@xyslh.cc.cd',
    'spenguin04@xyslh.cc.cd',
    'spenguin05@xyslh.cc.cd',
  ].join(','),
}

test('forwards recipients on the exact allowlist', () => {
  assert.equal(
    resolveForwardDestination('SPENGUIN03@XYSLH.CC.CD', env),
    'spenguin725@gmail.com',
  )
})

test('does not forward similar or unrelated recipients', () => {
  assert.equal(resolveForwardDestination('spenguin06@xyslh.cc.cd', env), null)
  assert.equal(resolveForwardDestination('accept-20260818@xyslh.cc.cd', env), null)
})

test('disables forwarding when the destination is missing', () => {
  assert.equal(
    resolveForwardDestination('spenguin01@xyslh.cc.cd', {
      FORWARD_EMAILS: env.FORWARD_EMAILS,
    }),
    null,
  )
})
