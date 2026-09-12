import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { getActiveFields, getComputedFieldValues } from '../../utils/fields'
import { computeAutoPaymentStatus } from '../../utils/formula'
import {
  computePayablePaid, computePayableRemaining, computePayableStatus,
  computeReceivableReceived, computeReceivableRemaining, computeReceivableStatus
} from '../../utils/status'
import { toApiNumber, toMoney } from '../../utils/money'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const id = getRouterParam(event, 'id')!
  const query = getQuery(event)
  const from = query.from ? new Date(query.from as string) : undefined
  // "to" is inclusive of the whole day, so a range/day/month filter
  // includes entries dated anywhere on the end date, not just at 00:00.
  const to = query.to ? new Date(query.to as string) : undefined
  if (to) to.setHours(23, 59, 59, 999)

  const party = await prisma.party.findFirst({
    where: { id, businessId: session.businessId },
    include: {
      payables: { include: { payments: true }, orderBy: { dueDate: 'desc' } },
      receivables: { include: { collections: true }, orderBy: { expectedDate: 'desc' } },
      transactions: {
        where: {
          ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
        },
        orderBy: { date: 'asc' } // oldest to latest by default; the client can reverse for display
      },
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

  const outstandingPayable = payables.reduce((s, p) => s + p.remaining, 0)
  const outstandingReceivable = receivables.reduce((s, r) => s + r.remaining, 0)

  // Entries view (see the invoice preview's stacked-card layout, which
  // this mirrors): each of this party's ledger transactions (within the
  // requested date filter, if any) shown with its custom field values.
  const transactionFieldDefs = await getActiveFields(session.businessId, 'TRANSACTION')
  const tableFieldDefs = transactionFieldDefs.filter(f => f.showInTable)

  // Summary lines are entirely user-defined (see Settings -> Party
  // summary): each is either "label + which field to sum" (SUM) or
  // "label + compare two other summary lines' totals into a Paid/
  // Partially Paid/Unpaid badge" (STATUS) — not a fixed set of hardcoded
  // totals. Computed over the SAME filtered entry set as the Entries
  // list, so applying a date filter updates both together.
  const summaryDefs = await prisma.summaryFieldDefinition.findMany({
    where: { businessId: session.businessId },
    orderBy: { sortOrder: 'asc' }
  })
  const sumDefs = summaryDefs.filter(d => d.kind === 'SUM')
  const summaryTotals = new Map<string, ReturnType<typeof toMoney>>(sumDefs.map(d => [d.id, toMoney(0)]))

  const entries = await Promise.all(
    party.transactions.map(async (t) => {
      // Computed against ALL active fields, not just the table-flagged
      // subset — a FORMULA field's dependencies might not themselves be
      // flagged showInTable, and getComputedFieldValues only resolves a
      // formula whose dependencies are present in the field set it's
      // given.
      const allValues = transactionFieldDefs.length ? await getComputedFieldValues(transactionFieldDefs, t.id) : {}
      for (const def of sumDefs) {
        const v = allValues[def.sourceKey!]
        if (typeof v === 'number') summaryTotals.set(def.id, summaryTotals.get(def.id)!.plus(v))
      }
      const displayValues: Record<string, unknown> = {}
      for (const f of tableFieldDefs) displayValues[f.key] = allValues[f.key]
      return { id: t.id, date: t.date, description: t.description, fields: displayValues }
    })
  )

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
    party: { id: party.id, type: party.type, name: party.name, phone: party.phone, address: party.address, notes: party.notes },
    payables,
    receivables,
    entries,
    entryFieldDefs: tableFieldDefs.map(f => ({ key: f.key, label: f.label, type: f.type })),
    summaryFields,
    invoices: party.invoices.map(i => ({ id: i.id, invoiceNumber: i.invoiceNumber, createdAt: i.createdAt })),
    summary: {
      outstandingPayable,
      outstandingReceivable,
      netPosition: outstandingReceivable - outstandingPayable
    }
  }
})
