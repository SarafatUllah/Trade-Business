import { z } from 'zod'
import { nanoid } from 'nanoid'
import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { getActiveFields, getComputedFieldValues } from '../../utils/fields'
import { computePayablePaid, computePayableRemaining, computeReceivableReceived, computeReceivableRemaining } from '../../utils/status'
import { toApiNumber, toMoney } from '../../utils/money'
import { logAudit } from '../../utils/audit'

const schema = z.object({
  partyId: z.string(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  transactionIds: z.array(z.string()).optional(), // explicit selection overrides period filter
  columnKeys: z.array(z.string()).optional() // which dynamic fields to show; defaults to showInInvoice=true
})

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  const data = parsed.data

  const [business, party] = await Promise.all([
    prisma.business.findUnique({ where: { id: session.businessId } }),
    prisma.party.findFirst({ where: { id: data.partyId, businessId: session.businessId } })
  ])
  if (!party || !business) throw createError({ statusCode: 404, statusMessage: 'Party not found' })

  const txWhere: any = { businessId: session.businessId, partyId: data.partyId, isArchived: false }
  if (data.transactionIds?.length) txWhere.id = { in: data.transactionIds }
  else if (data.periodStart || data.periodEnd) {
    txWhere.date = {}
    if (data.periodStart) txWhere.date.gte = new Date(data.periodStart)
    if (data.periodEnd) txWhere.date.lte = new Date(data.periodEnd)
  }

  const [transactions, allFields, payables, receivables] = await Promise.all([
    prisma.transaction.findMany({ where: txWhere, orderBy: { date: 'asc' } }),
    getActiveFields(session.businessId, 'TRANSACTION'),
    prisma.payable.findMany({ where: { businessId: session.businessId, partyId: data.partyId, isArchived: false }, include: { payments: true } }),
    prisma.receivable.findMany({ where: { businessId: session.businessId, partyId: data.partyId, isArchived: false }, include: { collections: true } })
  ])

  const invoiceFields = data.columnKeys?.length
    ? allFields.filter(f => data.columnKeys!.includes(f.key))
    : allFields.filter(f => f.showInInvoice)

  const rows = await Promise.all(
    transactions.map(async (t) => ({ transactionId: t.id, values: await getComputedFieldValues(invoiceFields, t.id) }))
  )

  // Total amount: sum of any CURRENCY-typed invoice column found on each row
  // (falls back to counting rows if none configured) — a business typically
  // marks its "Gross"/"Net" formula field as the invoice total column.
  const currencyCols = invoiceFields.filter(f => f.type === 'CURRENCY' || f.type === 'FORMULA')
  let totalAmount = toMoney(0)
  for (const row of rows) {
    for (const col of currencyCols) {
      const v = row.values[col.key]
      if (typeof v === 'number') totalAmount = totalAmount.plus(v)
    }
  }

  const totalPaid = payables.reduce((s, p) => s.plus(computePayablePaid(p)), toMoney(0))
  const totalReceived = receivables.reduce((s, r) => s.plus(computeReceivableReceived(r)), toMoney(0))
  const totalPayable = payables.reduce((s, p) => s.plus(computePayableRemaining(p)), toMoney(0))
  const totalReceivable = receivables.reduce((s, r) => s.plus(computeReceivableRemaining(r)), toMoney(0))

  const invoiceNumber = `INV-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        businessId: session.businessId,
        partyId: data.partyId,
        invoiceNumber,
        periodStart: data.periodStart ? new Date(data.periodStart) : null,
        periodEnd: data.periodEnd ? new Date(data.periodEnd) : null,
        fieldConfig: JSON.stringify(invoiceFields.map(f => ({ key: f.key, label: f.label }))),
        totalAmount: toApiNumber(totalAmount),
        totalPaid: toApiNumber(totalPaid),
        totalReceived: toApiNumber(totalReceived)
      }
    })
    for (const row of rows) {
      await tx.invoiceItem.create({
        data: {
          invoiceId: created.id,
          transactionId: row.transactionId,
          amount: (() => {
            let sum = toMoney(0)
            for (const col of currencyCols) {
              const v = row.values[col.key]
              if (typeof v === 'number') sum = sum.plus(v)
            }
            return toApiNumber(sum)
          })(),
          snapshot: JSON.stringify(row.values)
        }
      })
    }
    return created
  })

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'Invoice', entityId: invoice.id, action: 'CREATE', after: invoice })

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    totalAmount: toApiNumber(totalAmount),
    summary: {
      totalAmount: toApiNumber(totalAmount),
      totalPaid: toApiNumber(totalPaid),
      totalReceived: toApiNumber(totalReceived),
      totalPayable: toApiNumber(totalPayable),
      totalReceivable: toApiNumber(totalReceivable),
      outstandingBalance: toApiNumber(totalPayable.minus(totalReceivable))
    },
    columns: invoiceFields.map(f => ({ key: f.key, label: f.label })),
    rows: rows.map(r => r.values)
  }
})
