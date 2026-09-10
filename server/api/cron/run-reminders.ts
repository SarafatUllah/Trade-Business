import { runDueReminders } from '../../services/reminder-engine'
import { deactivateExpiredTrials } from '../../services/trial-expiry'

// This endpoint must be invoked periodically (e.g. every 15-60 minutes) by
// a real scheduler — GitHub Actions on a cron schedule, Vercel Cron Jobs
// (see vercel.json — Vercel automatically sends `Authorization: Bearer
// $CRON_SECRET` for cron-triggered requests when CRON_SECRET is set as an
// env var), or a plain OS crontab hitting this URL with curl using the
// `x-cron-secret` header. The app itself never relies on a browser being
// open (per spec: no client-side timers).
export default defineEventHandler(async (event) => {
  const expected = process.env.CRON_SECRET
  const headerSecret = getHeader(event, 'x-cron-secret')
  const authHeader = getHeader(event, 'authorization')
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

  if (!expected || (headerSecret !== expected && bearerSecret !== expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or missing cron secret' })
  }
  const [reminderResult, trialResult] = await Promise.all([
    runDueReminders(),
    deactivateExpiredTrials()
  ])
  return { ok: true, ...reminderResult, ...trialResult, ranAt: new Date().toISOString() }
})
