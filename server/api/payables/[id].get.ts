import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { computePayablePaid, computePayableRemaining, computePayableStatus } from '../../utils/status'
import { toApiNumber } from '../../utils/money'
import { getActiveFields, getComputedFieldValues } from '../../utils/fields'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const id = getRouterParam(event, 'id')!

  const payable = await prisma.payable.findFirst({
    where: { id, businessId: session.businessId },
    include: {
      party: { select: { id: true, name: true, phone: true } },
      payments: { orderBy: { paidAt: 'desc' } },
      reminders: true
    }
  })
  if (!payable) throw createError({ statusCode: 404, statusMessage: 'Payable not found' })

  const fieldDefs = await getActiveFields(session.businessId, 'PAYABLE')
  const fields = fieldDefs.length ? await getComputedFieldValues(fieldDefs, payable.id) : {}

  return {
    id: payable.id,
    party: payable.party,
    originalAmount: toApiNumber(payable.originalAmount),
    paid: toApiNumber(computePayablePaid(payable)),
    remaining: toApiNumber(computePayableRemaining(payable)),
    dueDate: payable.dueDate,
    status: computePayableStatus(payable),
    notes: payable.notes,
    fields,
    fieldDefs,
    payments: payable.payments.map(p => ({
      id: p.id,
      amount: toApiNumber(p.amount),
      paidAt: p.paidAt,
      method: p.method,
      notes: p.notes,
      reversedAt: p.reversedAt,
      reversalReason: p.reversalReason
    })),
    reminders: payable.reminders.map(r => ({ id: r.id, daysBefore: r.daysBefore, isActive: r.isActive }))
  }
})
