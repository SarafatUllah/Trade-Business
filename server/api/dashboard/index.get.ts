import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { computePayableRemaining, computePayableStatus, computeReceivableRemaining, computeReceivableStatus } from '../../utils/status'
import { toApiNumber, toMoney } from '../../utils/money'

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  const [payables, receivables] = await Promise.all([
    prisma.payable.findMany({
      where: { businessId: session.businessId, isArchived: false },
      include: { party: { select: { id: true, name: true } }, payments: true }
    }),
    prisma.receivable.findMany({
      where: { businessId: session.businessId, isArchived: false },
      include: { party: { select: { id: true, name: true } }, collections: true }
    })
  ])

  let totalPayable = toMoney(0)
  let totalReceivable = toMoney(0)
  let dueToday = toMoney(0)
  let expectedToday = toMoney(0)
  let overduePayable = toMoney(0)
  let overdueReceivable = toMoney(0)
  const upcomingPayments: any[] = []
  const upcomingCollections: any[] = []

  for (const p of payables) {
    const remaining = computePayableRemaining(p)
    if (remaining.isZero()) continue
    totalPayable = totalPayable.plus(remaining)
    const status = computePayableStatus(p, now)
    if (status === 'OVERDUE') overduePayable = overduePayable.plus(remaining)
    if (p.dueDate >= todayStart && p.dueDate <= todayEnd) dueToday = dueToday.plus(remaining)
    if (p.dueDate > todayEnd) {
      upcomingPayments.push({ id: p.id, party: p.party, amount: toApiNumber(remaining), dueDate: p.dueDate })
    }
  }

  for (const r of receivables) {
    const remaining = computeReceivableRemaining(r)
    if (remaining.isZero()) continue
    totalReceivable = totalReceivable.plus(remaining)
    const status = computeReceivableStatus(r, now)
    if (status === 'OVERDUE') overdueReceivable = overdueReceivable.plus(remaining)
    if (r.expectedDate >= todayStart && r.expectedDate <= todayEnd) expectedToday = expectedToday.plus(remaining)
    if (r.expectedDate > todayEnd) {
      upcomingCollections.push({ id: r.id, party: r.party, amount: toApiNumber(remaining), expectedDate: r.expectedDate })
    }
  }

  upcomingPayments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  upcomingCollections.sort((a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime())

  const recentTransactions = await prisma.transaction.findMany({
    where: { businessId: session.businessId, isArchived: false },
    include: { party: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
    take: 10
  })

  return {
    totalReceivable: toApiNumber(totalReceivable),
    totalPayable: toApiNumber(totalPayable),
    netPosition: toApiNumber(totalReceivable.minus(totalPayable)),
    amountToPayToday: toApiNumber(dueToday),
    amountExpectedToday: toApiNumber(expectedToday),
    overduePayable: toApiNumber(overduePayable),
    overdueReceivable: toApiNumber(overdueReceivable),
    upcomingPayments: upcomingPayments.slice(0, 10),
    upcomingCollections: upcomingCollections.slice(0, 10),
    recentTransactions: recentTransactions.map(t => ({ id: t.id, date: t.date, description: t.description, party: t.party }))
  }
})
