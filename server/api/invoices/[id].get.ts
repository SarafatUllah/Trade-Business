import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
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
  const summaryTotals = new Map<string, ReturnType<typeof toMoney>>(summaryDefs.map(d => [d.id, toMoney(0)]))
  for (const item of invoice.items) {
    const snapshot = JSON.parse(item.snapshot) as Record<string, unknown>
    for (const def of summaryDefs) {
      const v = snapshot[def.sourceKey]
      if (typeof v === 'number') summaryTotals.set(def.id, summaryTotals.get(def.id)!.plus(v))
    }
  }

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    party: { name: invoice.party.name, phone: invoice.party.phone, address: invoice.party.address },
    business: { name: invoice.business.name, currency: invoice.business.currency },
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    columns,
    rows: invoice.items.map(i => ({ date: i.date, values: JSON.parse(i.snapshot) as Record<string, unknown> })),
    summaryFields: summaryDefs.map(d => ({ id: d.id, label: d.label, sourceKey: d.sourceKey, total: toApiNumber(summaryTotals.get(d.id)!) })),
    createdAt: invoice.createdAt
  }
})
