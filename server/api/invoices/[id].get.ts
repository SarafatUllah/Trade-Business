import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { toApiNumber } from '../../utils/money'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const id = getRouterParam(event, 'id')!

  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId: session.businessId },
    include: { party: true, items: true, business: true }
  })
  if (!invoice) throw createError({ statusCode: 404, statusMessage: 'Invoice not found' })

  const columns = JSON.parse(invoice.fieldConfig) as { key: string; label: string }[]

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    party: { name: invoice.party.name, phone: invoice.party.phone, address: invoice.party.address },
    business: { name: invoice.business.name, currency: invoice.business.currency },
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    columns,
    rows: invoice.items.map(i => JSON.parse(i.snapshot)),
    summary: {
      totalAmount: toApiNumber(invoice.totalAmount),
      totalPaid: toApiNumber(invoice.totalPaid),
      totalReceived: toApiNumber(invoice.totalReceived)
    },
    createdAt: invoice.createdAt
  }
})
