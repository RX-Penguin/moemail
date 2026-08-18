/// <reference types="@cloudflare/workers-types" />


declare global {
  interface CloudflareEnv {
    DB: D1Database;
    SITE_CONFIG: KVNamespace;
    FORWARD_TO_EMAIL?: string;
    FORWARD_EMAILS?: string;
  }

  interface Window {
    turnstile?: {
      render: (element: HTMLElement | string, options: Record<string, unknown>) => string
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
  }

  type Env = CloudflareEnv
}

declare module "next-auth" {
  interface User {
    roles?: { name: string }[]
    username?: string | null
    providers?: string[]
  }

  interface Session {
    user: User
  }
}

export type { Env }
