import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const config = useRuntimeConfig(event)

  if (!config.vapidPublicKey || !config.vapidPrivateKey) {
    throw createError({
      statusCode: 400,
      statusMessage: 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set on the server. Add them in Vercel → Settings → Environment Variables (Production), then redeploy.'
    })
  }

  const subs = await prisma.pushSubscription.findMany({ where: { userId: session.userId } })
  if (!subs.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No push subscription found for your account on this device. Tap "Enable push notifications" first and allow the permission prompt.'
    })
  }

  const webpush = await import('web-push').catch(() => null)
  if (!webpush) {
    throw createError({ statusCode: 500, statusMessage: 'The web-push package is not available on the server.' })
  }
  webpush.default.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey)

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush!.default.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } } as any,
        JSON.stringify({ title: 'Test notification', body: 'Push notifications are working on this device 🎉', data: {} })
      )
    )
  )

  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  const successes = results.length - failures.length

  await prisma.notification.create({
    data: {
      businessId: session.businessId,
      userId: session.userId,
      channel: 'PUSH',
      title: 'Test notification',
      body: 'Push notifications are working on this device 🎉',
      sentAt: successes > 0 ? new Date() : null
    }
  })

  if (successes === 0) {
    const reason: any = failures[0]?.reason
    const statusCode = reason?.statusCode
    let hint = reason?.body || reason?.message || 'Unknown error from the push service.'
    if (statusCode === 410 || statusCode === 404) {
      hint = 'This subscription has expired or was removed by the browser. Disable and re-enable push notifications, then try again.'
    } else if (statusCode === 401 || statusCode === 403) {
      hint = 'The push service rejected the VAPID credentials — double-check VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are the exact pair generated together, with no extra spaces.'
    }
    throw createError({ statusCode: 502, statusMessage: `Push delivery failed (${statusCode || 'no status'}): ${hint}` })
  }

  return { success: true, delivered: successes, failed: failures.length }
})
