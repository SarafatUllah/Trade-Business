import { requireSession } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { generateInvoicePdf } from '../../../services/pdf-invoice'
import { toApiNumber } from '../../../utils/money'
import { computePayableRemaining, computeReceivableRemaining } from '../../../utils/status'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const id = getRouterParam(event, 'id')!

  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId: session.businessId },
    include: { party: true, items: true, business: true }
  })
  if (!invoice) throw createError({ statusCode: 404, statusMessage: 'Invoice not found' })

  const [payables, receivables] = await Promise.all([
    prisma.payable.findMany({ where: { businessId: session.businessId, partyId: invoice.partyId, isArchived: false }, include: { payments: true } }),
    prisma.receivable.findMany({ where: { businessId: session.businessId, partyId: invoice.partyId, isArchived: false }, include: { collections: true } })
  ])
  const totalPayable = payables.reduce((s, p) => s + toApiNumber(computePayableRemaining(p)), 0)
  const totalReceivable = receivables.reduce((s, r) => s + toApiNumber(computeReceivableRemaining(r)), 0)

  const columns = JSON.parse(invoice.fieldConfig) as { key: string; label: string }[]
  const pdfBuffer = await generateInvoicePdf({
    business: { name: invoice.business.name, currency: invoice.business.currency },
    party: { name: invoice.party.name, phone: invoice.party.phone, address: invoice.party.address },
    invoiceNumber: invoice.invoiceNumber,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    columns,
    rows: invoice.items.map(i => JSON.parse(i.snapshot)),
    summary: {
      totalAmount: toApiNumber(invoice.totalAmount),
      totalPaid: toApiNumber(invoice.totalPaid),
      totalReceived: toApiNumber(invoice.totalReceived),
      totalPayable,
      totalReceivable,
      outstandingBalance: totalPayable - totalReceivable
    }
  })

  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`
  })
  return pdfBuffer
})
