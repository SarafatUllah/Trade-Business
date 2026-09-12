import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { computePayableRemaining, computeReceivableRemaining } from '../../utils/status'
import { toApiNumber, toMoney } from '../../utils/money'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const query = getQuery(event)
  const search = (query.search as string) || undefined

  const parties = await prisma.party.findMany({
    where: {
      businessId: session.businessId,
      isArchived: false,
      ...(search ? { name: { contains: search } } : {})
    },
    include: {
      payables: { where: { isArchived: false }, include: { payments: true } },
      receivables: { where: { isArchived: false }, include: { collections: true } }
    },
    orderBy: { name: 'asc' }
  })

  return parties.map(p => {
    const outstandingPayable = p.payables.reduce((sum, pay) => sum.plus(computePayableRemaining(pay)), toMoney(0))
    const outstandingReceivable = p.receivables.reduce((sum, rec) => sum.plus(computeReceivableRemaining(rec)), toMoney(0))
    return {
      id: p.id,
      type: p.type,
      name: p.name,
      phone: p.phone,
      address: p.address,
      outstandingPayable: toApiNumber(outstandingPayable),
      outstandingReceivable: toApiNumber(outstandingReceivable),
      netPosition: toApiNumber(outstandingReceivable.minus(outstandingPayable))
    }
  })
})
