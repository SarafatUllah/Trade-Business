import { prisma } from './prisma'
import { computeAutoPaymentStatus } from './formula'
import { toApiNumber, toMoney } from './money'

export interface InvoiceSummaryField {
  id: string
  label: string
  kind: 'SUM' | 'STATUS'
  total?: number
  status?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | null
}

/** Computes the user-defined Summary lines (Settings -> Party summary)
 *  for a given invoice, from its items' frozen snapshots. Single source
 *  of truth for both the web invoice detail page and the downloaded
 *  PDF — previously the PDF used the invoice's own fixed totalAmount/
 *  totalPaid/totalReceived columns while the web page used this
 *  configurable system, so they silently showed different numbers. */
export async function computeInvoiceSummaryFields(
  businessId: string,
  items: { snapshot: string }[]
): Promise<InvoiceSummaryField[]> {
  const summaryDefs = await prisma.summaryFieldDefinition.findMany({
    where: { businessId },
    orderBy: { sortOrder: 'asc' }
  })
  const sumDefs = summaryDefs.filter(d => d.kind === 'SUM')
  const summaryTotals = new Map<string, ReturnType<typeof toMoney>>(sumDefs.map(d => [d.id, toMoney(0)]))

  for (const item of items) {
    const snapshot = JSON.parse(item.snapshot) as Record<string, unknown>
    for (const def of sumDefs) {
      const v = snapshot[def.sourceKey!]
      if (typeof v === 'number') summaryTotals.set(def.id, summaryTotals.get(def.id)!.plus(v))
    }
  }

  return summaryDefs.map(d => {
    if (d.kind === 'STATUS') {
      const total = d.statusTotalSummaryId ? toApiNumber(summaryTotals.get(d.statusTotalSummaryId) ?? toMoney(0)) : null
      const paid = d.statusPaidSummaryId ? toApiNumber(summaryTotals.get(d.statusPaidSummaryId) ?? toMoney(0)) : null
      return { id: d.id, label: d.label, kind: d.kind, status: computeAutoPaymentStatus(total, paid) }
    }
    return { id: d.id, label: d.label, kind: d.kind, total: toApiNumber(summaryTotals.get(d.id)!) }
  })
}
