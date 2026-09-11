import { prisma } from '../utils/prisma'

// Neon's free tier suspends its compute after 5 minutes of no queries —
// the next request then has to wait for it to resume, which is the exact
// "very slow, but only the first time" pattern this app was showing.
// This endpoint exists purely to be pinged periodically (see
// .github/workflows/keep-alive.yml) by a free external scheduler, since
// Vercel's own Cron Jobs are limited to once/day on the Hobby plan and
// can't ping frequently enough to prevent the suspend. Deliberately
// unauthenticated and trivial — it does the cheapest possible real query
// (not just "does the DB respond to a TCP ping") so it genuinely counts
// as activity to Neon's idle-detection.
export default defineEventHandler(async () => {
  const start = Date.now()
  await prisma.$queryRaw`SELECT 1`
  return { ok: true, dbLatencyMs: Date.now() - start, timestamp: new Date().toISOString() }
})
