import { requireSession } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { generateInvoicePdf } from '../../../services/pdf-invoice'
import { computeInvoiceSummaryFields } from '../../../utils/invoice-summary'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const id = getRouterParam(event, 'id')!

  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId: session.businessId },
    include: { party: true, items: { orderBy: { date: 'asc' } }, business: true }
  })
  if (!invoice) throw createError({ statusCode: 404, statusMessage: 'Invoice not found' })

  const columns = JSON.parse(invoice.fieldConfig) as { key: string; label: string }[]
  // Same shared computation the web invoice page uses (see
  // server/utils/invoice-summary.ts) — previously this endpoint computed
  // its own separate fixed totals, so the downloaded PDF and the web
  // page could show different numbers for the same invoice.
  const summaryFields = await computeInvoiceSummaryFields(session.businessId, invoice.items)

  const pdfBuffer = await generateInvoicePdf({
    business: { name: invoice.business.name, currency: invoice.business.currency },
    party: { name: invoice.party.name, phone: invoice.party.phone, address: invoice.party.address },
    invoiceNumber: invoice.invoiceNumber,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    columns,
    rows: invoice.items.map(i => JSON.parse(i.snapshot)),
    summaryFields
  })

  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`
  })
  return pdfBuffer
})
