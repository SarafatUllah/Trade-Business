import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { computePayablePaid, computePayableRemaining, computePayableStatus } from '../../utils/status'
import { toApiNumber } from '../../utils/money'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const query = getQuery(event)

  const where: any = { businessId: session.businessId, isArchived: false }
  if (query.partyId) where.partyId = query.partyId as string
  if (query.dateFrom || query.dateTo) {
    where.dueDate = {}
    if (query.dateFrom) where.dueDate.gte = new Date(query.dateFrom as string)
    if (query.dateTo) where.dueDate.lte = new Date(query.dateTo as string)
  }

  const payables = await prisma.payable.findMany({
    where,
    include: { party: { select: { id: true, name: true } }, payments: true },
    orderBy: { dueDate: 'asc' }
  })

  let rows = payables.map(p => ({
    id: p.id,
    party: p.party,
    originalAmount: toApiNumber(p.originalAmount),
    paid: toApiNumber(computePayablePaid(p)),
    remaining: toApiNumber(computePayableRemaining(p)),
    dueDate: p.dueDate,
    status: computePayableStatus(p),
    notes: p.notes
  }))

  if (query.status) rows = rows.filter(r => r.status === query.status)

  return rows
})
