import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { computeReceivableReceived, computeReceivableRemaining, computeReceivableStatus } from '../../utils/status'
import { toApiNumber } from '../../utils/money'
import { getActiveFields, getComputedFieldValues } from '../../utils/fields'

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

  const fieldDefs = await getActiveFields(session.businessId, 'RECEIVABLE')
  const fields = fieldDefs.length ? await getComputedFieldValues(fieldDefs, receivable.id) : {}

  return {
    id: receivable.id,
    party: receivable.party,
    originalAmount: toApiNumber(receivable.originalAmount),
    received: toApiNumber(computeReceivableReceived(receivable)),
    remaining: toApiNumber(computeReceivableRemaining(receivable)),
    expectedDate: receivable.expectedDate,
    status: computeReceivableStatus(receivable),
    notes: receivable.notes,
    fields,
    fieldDefs,
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
