import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { computeReceivableReceived, computeReceivableRemaining, computeReceivableStatus } from '../../utils/status'
import { toApiNumber } from '../../utils/money'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const query = getQuery(event)

  const where: any = { businessId: session.businessId, isArchived: false }
  if (query.partyId) where.partyId = query.partyId as string
  if (query.dateFrom || query.dateTo) {
    where.expectedDate = {}
    if (query.dateFrom) where.expectedDate.gte = new Date(query.dateFrom as string)
    if (query.dateTo) where.expectedDate.lte = new Date(query.dateTo as string)
  }

  const receivables = await prisma.receivable.findMany({
    where,
    include: { party: { select: { id: true, name: true } }, collections: true },
    orderBy: { expectedDate: 'asc' }
  })

  let rows = receivables.map(r => ({
    id: r.id,
    party: r.party,
    originalAmount: toApiNumber(r.originalAmount),
    received: toApiNumber(computeReceivableReceived(r)),
    remaining: toApiNumber(computeReceivableRemaining(r)),
    expectedDate: r.expectedDate,
    status: computeReceivableStatus(r),
    notes: r.notes
  }))

  if (query.status) rows = rows.filter(r => r.status === query.status)

  return rows
})
