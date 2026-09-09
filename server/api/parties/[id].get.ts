import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import {
  computePayablePaid, computePayableRemaining, computePayableStatus,
  computeReceivableReceived, computeReceivableRemaining, computeReceivableStatus
} from '../../utils/status'
import { toApiNumber, toMoney } from '../../utils/money'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const id = getRouterParam(event, 'id')!

  const party = await prisma.party.findFirst({
    where: { id, businessId: session.businessId },
    include: {
      payables: { include: { payments: true }, orderBy: { dueDate: 'desc' } },
      receivables: { include: { collections: true }, orderBy: { expectedDate: 'desc' } },
      transactions: { orderBy: { date: 'desc' }, take: 100 },
      invoices: { orderBy: { createdAt: 'desc' } }
    }
  })
  if (!party) throw createError({ statusCode: 404, statusMessage: 'Party not found' })

  const payables = party.payables.map(p => ({
    id: p.id,
    originalAmount: toApiNumber(p.originalAmount),
    paid: toApiNumber(computePayablePaid(p)),
    remaining: toApiNumber(computePayableRemaining(p)),
    dueDate: p.dueDate,
    status: computePayableStatus(p),
    notes: p.notes
  }))

  const receivables = party.receivables.map(r => ({
    id: r.id,
    originalAmount: toApiNumber(r.originalAmount),
    received: toApiNumber(computeReceivableReceived(r)),
    remaining: toApiNumber(computeReceivableRemaining(r)),
    expectedDate: r.expectedDate,
    status: computeReceivableStatus(r),
    notes: r.notes
  }))

  const totalPayable = party.payables.reduce((s, p) => s.plus(p.originalAmount as any), toMoney(0))
  const totalReceivable = party.receivables.reduce((s, r) => s.plus(r.originalAmount as any), toMoney(0))
  const totalPaid = party.payables.reduce((s, p) => s.plus(computePayablePaid(p)), toMoney(0))
  const totalReceived = party.receivables.reduce((s, r) => s.plus(computeReceivableReceived(r)), toMoney(0))
  const outstandingPayable = payables.reduce((s, p) => s + p.remaining, 0)
  const outstandingReceivable = receivables.reduce((s, r) => s + r.remaining, 0)

  return {
    party: { id: party.id, name: party.name, phone: party.phone, address: party.address, notes: party.notes },
    payables,
    receivables,
    transactions: party.transactions,
    invoices: party.invoices.map(i => ({ id: i.id, invoiceNumber: i.invoiceNumber, totalAmount: toApiNumber(i.totalAmount), createdAt: i.createdAt })),
    summary: {
      totalPayable: toApiNumber(totalPayable),
      totalReceivable: toApiNumber(totalReceivable),
      totalPaid: toApiNumber(totalPaid),
      totalReceived: toApiNumber(totalReceived),
      outstandingPayable,
      outstandingReceivable,
      netPosition: outstandingReceivable - outstandingPayable
    }
  }
})
