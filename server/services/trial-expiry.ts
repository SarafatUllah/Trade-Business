import { prisma } from '../utils/prisma'

/** Deactivates any ACTIVE business whose trial deadline has passed. Runs
 *  as part of the same scheduled cron as reminders (see
 *  server/api/cron/run-reminders.ts) rather than a separate cron job, to
 *  stay within hosting plans that limit the number of scheduled jobs. */
export async function deactivateExpiredTrials(now: Date = new Date()): Promise<{ deactivated: number }> {
  const result = await prisma.business.updateMany({
    where: {
      accountStatus: 'ACTIVE',
      trialEndsAt: { lt: now }
    },
    data: { accountStatus: 'DEACTIVATED' }
  })
  return { deactivated: result.count }
}
