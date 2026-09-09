import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { toApiNumber } from '../../utils/money'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const query = getQuery(event)

  const invoices = await prisma.invoice.findMany({
    where: { businessId: session.businessId, ...(query.partyId ? { partyId: query.partyId as string } : {}) },
    include: { party: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' }
  })

  return invoices.map(i => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    party: i.party,
    totalAmount: toApiNumber(i.totalAmount),
    periodStart: i.periodStart,
    periodEnd: i.periodEnd,
    createdAt: i.createdAt
  }))
})
