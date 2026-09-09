import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { computeReceivableReceived, computeReceivableRemaining, computeReceivableStatus } from '../../utils/status'
import { toApiNumber } from '../../utils/money'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const id = getRouterParam(event, 'id')!

  const receivable = await prisma.receivable.findFirst({
    where: { id, businessId: session.businessId },
    include: {
      party: { select: { id: true, name: true, phone: true } },
      collections: { orderBy: { receivedAt: 'desc' } },
      reminders: true
    }
  })
  if (!receivable) throw createError({ statusCode: 404, statusMessage: 'Receivable not found' })

  return {
    id: receivable.id,
    party: receivable.party,
    originalAmount: toApiNumber(receivable.originalAmount),
    received: toApiNumber(computeReceivableReceived(receivable)),
    remaining: toApiNumber(computeReceivableRemaining(receivable)),
    expectedDate: receivable.expectedDate,
    status: computeReceivableStatus(receivable),
    notes: receivable.notes,
    collections: receivable.collections.map(c => ({
      id: c.id,
      amount: toApiNumber(c.amount),
      receivedAt: c.receivedAt,
      method: c.method,
      notes: c.notes,
      reversedAt: c.reversedAt,
      reversalReason: c.reversalReason
    })),
    reminders: receivable.reminders.map(r => ({ id: r.id, daysBefore: r.daysBefore, isActive: r.isActive }))
  }
})
