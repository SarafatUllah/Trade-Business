import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { computeInvoiceSummaryFields } from '../../utils/invoice-summary'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const id = getRouterParam(event, 'id')!

  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId: session.businessId },
    include: { party: true, items: { orderBy: { date: 'asc' } }, business: true }
  })
  if (!invoice) throw createError({ statusCode: 404, statusMessage: 'Invoice not found' })

  const columns = JSON.parse(invoice.fieldConfig) as { key: string; label: string }[]
  const summaryFields = await computeInvoiceSummaryFields(session.businessId, invoice.items)

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    party: { name: invoice.party.name, phone: invoice.party.phone, address: invoice.party.address },
    business: { name: invoice.business.name, currency: invoice.business.currency },
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    columns,
    rows: invoice.items.map(i => ({ date: i.date, values: JSON.parse(i.snapshot) as Record<string, unknown> })),
    summaryFields,
    createdAt: invoice.createdAt
  }
})
