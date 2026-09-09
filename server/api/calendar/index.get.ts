import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { computePayableRemaining, computeReceivableRemaining } from '../../utils/status'
import { toApiNumber } from '../../utils/money'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const query = getQuery(event)

  const from = query.from ? new Date(query.from as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const to = query.to ? new Date(query.to as string) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59)

  const [payables, receivables] = await Promise.all([
    prisma.payable.findMany({
      where: { businessId: session.businessId, isArchived: false, dueDate: { gte: from, lte: to } },
      include: { party: { select: { id: true, name: true } }, payments: true }
    }),
    prisma.receivable.findMany({
      where: { businessId: session.businessId, isArchived: false, expectedDate: { gte: from, lte: to } },
      include: { party: { select: { id: true, name: true } }, collections: true }
    })
  ])

  const events = [
    ...payables.map(p => ({
      type: 'PAY' as const,
      date: p.dueDate,
      amount: toApiNumber(computePayableRemaining(p)),
      party: p.party,
      id: p.id
    })),
    ...receivables.map(r => ({
      type: 'RECEIVE' as const,
      date: r.expectedDate,
      amount: toApiNumber(computeReceivableRemaining(r)),
      party: r.party,
      id: r.id
    }))
  ].filter(e => e.amount > 0)

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return { from, to, events }
})
