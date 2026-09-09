import { prisma } from '../utils/prisma'

// ============================================================
// Notification provider abstraction.
//
// Adding a new channel (SMS/Email/WhatsApp) later means writing one class
// that implements this interface and registering it below — no changes to
// the reminder engine or API routes are required.
// ============================================================

export interface NotificationPayload {
  businessId: string
  userId?: string | null
  title: string
  body: string
  data?: Record<string, unknown>
}

export interface NotificationProvider {
  readonly channel: 'IN_APP' | 'PUSH' | 'SMS' | 'EMAIL' | 'WHATSAPP'
  send(payload: NotificationPayload): Promise<void>
}

// Always available: writes a row the UI polls/fetches. This is the one
// channel that requires no external credentials.
class InAppProvider implements NotificationProvider {
  readonly channel = 'IN_APP' as const
  async send(payload: NotificationPayload) {
    await prisma.notification.create({
      data: {
        businessId: payload.businessId,
        userId: payload.userId ?? null,
        channel: 'IN_APP',
        title: payload.title,
        body: payload.body,
        data: payload.data ? JSON.stringify(payload.data) : null,
        sentAt: new Date()
      }
    })
  }
}

// Web Push (PWA). Requires VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY env vars.
// Falls back to a no-op with a console notice in local/dev when unset, so
// the rest of the app keeps working without credentials.
class PushProvider implements NotificationProvider {
  readonly channel = 'PUSH' as const
  async send(payload: NotificationPayload) {
    const config = useRuntimeConfig()
    const notif = await prisma.notification.create({
      data: {
        businessId: payload.businessId,
        userId: payload.userId ?? null,
        channel: 'PUSH',
        title: payload.title,
        body: payload.body,
        data: payload.data ? JSON.stringify(payload.data) : null
      }
    })

    if (!config.vapidPublicKey || !config.vapidPrivateKey) {
      console.warn('[push] VAPID keys not configured — skipping actual push delivery (dev mode).')
      return
    }

    const subs = payload.userId
      ? await prisma.pushSubscription.findMany({ where: { userId: payload.userId } })
      : []
    if (!subs.length) return

    const webpush = await import('web-push').catch(() => null)
    if (!webpush) {
      console.warn('[push] web-push package not installed — run `npm install web-push` to enable delivery.')
      return
    }
    webpush.default.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey)

    await Promise.allSettled(
      subs.map(sub =>
        webpush!.default.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } } as any,
          JSON.stringify({ title: payload.title, body: payload.body, data: payload.data })
        )
      )
    )

    await prisma.notification.update({ where: { id: notif.id }, data: { sentAt: new Date() } })
  }
}

// Stub providers: implement the interface so the reminder engine can target
// them, but they only log until real credentials + an SDK are wired in.
class StubProvider implements NotificationProvider {
  constructor(readonly channel: 'SMS' | 'EMAIL' | 'WHATSAPP') {}
  async send(payload: NotificationPayload) {
    console.warn(`[${this.channel}] provider not configured — message not sent: "${payload.title}"`)
  }
}

const providers: NotificationProvider[] = [
  new InAppProvider(),
  new PushProvider(),
  new StubProvider('SMS'),
  new StubProvider('EMAIL'),
  new StubProvider('WHATSAPP')
]

export function getProvider(channel: NotificationProvider['channel']): NotificationProvider {
  const p = providers.find(p => p.channel === channel)
  if (!p) throw new Error(`No notification provider registered for channel ${channel}`)
  return p
}

/** Dispatches to every currently-enabled channel for a business. For now
 *  that's IN_APP + PUSH; wire SMS/EMAIL/WHATSAPP here once configured. */
export async function dispatchNotification(payload: NotificationPayload, channels: NotificationProvider['channel'][] = ['IN_APP', 'PUSH']) {
  await Promise.allSettled(channels.map(ch => getProvider(ch).send(payload)))
}
