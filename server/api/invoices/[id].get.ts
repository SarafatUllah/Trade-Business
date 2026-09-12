import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { computeAutoPaymentStatus } from '../../utils/formula'
import { toApiNumber, toMoney } from '../../utils/money'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const id = getRouterParam(event, 'id')!

  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId: session.businessId },
    include: { party: true, items: { orderBy: { date: 'asc' } }, business: true }
  })
  if (!invoice) throw createError({ statusCode: 404, statusMessage: 'Invoice not found' })

  const columns = JSON.parse(invoice.fieldConfig) as { key: string; label: string }[]

  // Summary is computed live from the SAME user-defined Party summary
  // lines (Settings -> Party summary), not the invoice's own fixed
  // Total Amount/Paid/Received — consistent with how the Party page's
  // summary works, and lets a summary line added after this invoice was
  // generated still work correctly, since each item's snapshot captured
  // every active field's value (not just the ones shown as columns).
  const summaryDefs = await prisma.summaryFieldDefinition.findMany({
    where: { businessId: session.businessId },
    orderBy: { sortOrder: 'asc' }
  })
  const sumDefs = summaryDefs.filter(d => d.kind === 'SUM')
  const summaryTotals = new Map<string, ReturnType<typeof toMoney>>(sumDefs.map(d => [d.id, toMoney(0)]))
  for (const item of invoice.items) {
    const snapshot = JSON.parse(item.snapshot) as Record<string, unknown>
    for (const def of sumDefs) {
      const v = snapshot[def.sourceKey!]
      if (typeof v === 'number') summaryTotals.set(def.id, summaryTotals.get(def.id)!.plus(v))
    }
  }

  // STATUS lines compare two SUM lines' already-computed totals — a
  // second pass, after every SUM total is known.
  const summaryFields = summaryDefs.map(d => {
    if (d.kind === 'STATUS') {
      const total = d.statusTotalSummaryId ? toApiNumber(summaryTotals.get(d.statusTotalSummaryId) ?? toMoney(0)) : null
      const paid = d.statusPaidSummaryId ? toApiNumber(summaryTotals.get(d.statusPaidSummaryId) ?? toMoney(0)) : null
      return { id: d.id, label: d.label, kind: d.kind, status: computeAutoPaymentStatus(total, paid) }
    }
    return { id: d.id, label: d.label, kind: d.kind, total: toApiNumber(summaryTotals.get(d.id)!) }
  })

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
