import { runDueReminders } from '../../services/reminder-engine'

// This endpoint must be invoked periodically (e.g. every 15-60 minutes) by
// a real scheduler — GitHub Actions on a cron schedule, Vercel Cron Jobs,
// or a plain OS crontab hitting this URL with curl. The app itself never
// relies on a browser being open (per spec: no client-side timers).
export default defineEventHandler(async (event) => {
  const secret = getHeader(event, 'x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or missing cron secret' })
  }
  const result = await runDueReminders()
  return { ok: true, ...result, ranAt: new Date().toISOString() }
})
