import dayjs from 'dayjs'
import { prisma } from '../utils/prisma'
import { computePayableRemaining, computeReceivableRemaining } from '../utils/status'
import { formatCurrency } from '../utils/money'
import { dispatchNotification } from './notification-providers'

// ============================================================
// Reminder engine — runs on the backend via a scheduled job (see
// server/api/cron/run-reminders.post.ts), never relying on client-side
// timers. A reminder is "due to fire" when today's date matches
// (obligationDate - daysBefore), it hasn't already fired today, and the
// obligation is not yet fully settled. Overdue nudges (daysBefore < 0)
// fire once per day for as long as the obligation remains outstanding.
// ============================================================

function isSameDay(a: Date, b: Date) {
  return dayjs(a).format('YYYY-MM-DD') === dayjs(b).format('YYYY-MM-DD')
}

export async function runDueReminders(now: Date = new Date()): Promise<{ fired: number }> {
  let fired = 0

  const payableReminders = await prisma.reminder.findMany({
    where: { obligationType: 'PAYABLE', isActive: true },
    include: {
      payable: { include: { party: true, payments: true, business: { include: { memberships: true } } } }
    }
  })

  for (const reminder of payableReminders) {
    const payable = reminder.payable
    if (!payable || payable.isArchived) continue
    const remaining = computePayableRemaining(payable)
    if (remaining.isZero()) continue // fully settled — stop reminding

    const targetDate = dayjs(payable.dueDate).subtract(reminder.daysBefore, 'day').toDate()
    if (!isSameDay(targetDate, now)) continue
    if (reminder.lastFiredAt && isSameDay(reminder.lastFiredAt, now)) continue

    const overdue = dayjs(now).isAfter(dayjs(payable.dueDate), 'day')
    const amountStr = formatCurrency(remaining, payable.business.currency)
    const title = overdue ? 'Overdue Payment' : 'Payment Reminder'
    const body = overdue
      ? `Overdue: ${amountStr} payable to ${payable.party.name} is past due (${dayjs(payable.dueDate).format('D MMM')}).`
      : `Payment Reminder: You must pay ${payable.party.name} ${amountStr} by ${dayjs(payable.dueDate).format('D MMMM')}.`

    for (const member of payable.business.memberships) {
      await dispatchNotification({
        businessId: payable.businessId,
        userId: member.userId,
        title,
        body,
        data: { obligationType: 'PAYABLE', payableId: payable.id }
      })
    }
    await prisma.reminder.update({ where: { id: reminder.id }, data: { lastFiredAt: now } })
    fired++
  }

  const receivableReminders = await prisma.reminder.findMany({
    where: { obligationType: 'RECEIVABLE', isActive: true },
    include: {
      receivable: { include: { party: true, collections: true, business: { include: { memberships: true } } } }
    }
  })

  for (const reminder of receivableReminders) {
    const receivable = reminder.receivable
    if (!receivable || receivable.isArchived) continue
    const remaining = computeReceivableRemaining(receivable)
    if (remaining.isZero()) continue

    const targetDate = dayjs(receivable.expectedDate).subtract(reminder.daysBefore, 'day').toDate()
    if (!isSameDay(targetDate, now)) continue
    if (reminder.lastFiredAt && isSameDay(reminder.lastFiredAt, now)) continue

    const overdue = dayjs(now).isAfter(dayjs(receivable.expectedDate), 'day')
    const amountStr = formatCurrency(remaining, receivable.business.currency)
    const title = overdue ? 'Overdue Collection' : 'Collection Reminder'
    const body = overdue
      ? `Overdue Collection: ${amountStr} from ${receivable.party.name} has not been received.`
      : `Collection Reminder: ${receivable.party.name} should pay you ${amountStr} on ${dayjs(receivable.expectedDate).format('D MMMM')}.`

    for (const member of receivable.business.memberships) {
      await dispatchNotification({
        businessId: receivable.businessId,
        userId: member.userId,
        title,
        body,
        data: { obligationType: 'RECEIVABLE', receivableId: receivable.id }
      })
    }
    await prisma.reminder.update({ where: { id: reminder.id }, data: { lastFiredAt: now } })
    fired++
  }

  return { fired }
}
