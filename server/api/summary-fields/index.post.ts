import { z } from 'zod'
import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { getActiveFields } from '../../utils/fields'

const schema = z.object({
  label: z.string().min(1).max(100),
  kind: z.enum(['SUM', 'STATUS']).default('SUM'),
  // Deliberately NOT .min(1) here — the form always sends all three of
  // these keys regardless of which kind is selected (the unused ones as
  // ''), so a .min(1) constraint rejected the request before it even
  // reached the kind-specific checks below, which already correctly
  // treat an empty string as "not provided" via a plain falsy check.
  sourceKey: z.string().optional(),
  statusTotalSummaryId: z.string().optional(),
  statusPaidSummaryId: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const session = requireRole(event, 'STAFF')
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  const data = parsed.data

  if (data.kind === 'SUM') {
    if (!data.sourceKey) throw createError({ statusCode: 400, statusMessage: 'Select a field to sum' })
    const activeFields = await getActiveFields(session.businessId, 'TRANSACTION')
    const sourceField = activeFields.find(f => f.key === data.sourceKey)
    if (!sourceField) throw createError({ statusCode: 400, statusMessage: 'That field was not found among active Ledger fields' })
    if (!['NUMBER', 'CURRENCY', 'FORMULA'].includes(sourceField.type)) {
      throw createError({ statusCode: 400, statusMessage: `"${sourceField.label}" is a ${sourceField.type} field and can't be summed — choose a Number, Currency, or Formula field` })
    }
  } else {
    if (!data.statusTotalSummaryId || !data.statusPaidSummaryId) {
      throw createError({ statusCode: 400, statusMessage: 'A Payment Status summary line needs both a Total line and a Paid line selected' })
    }
    const existingSums = await prisma.summaryFieldDefinition.findMany({
      where: { businessId: session.businessId, kind: 'SUM', id: { in: [data.statusTotalSummaryId, data.statusPaidSummaryId] } }
    })
    if (existingSums.length !== 2) {
      throw createError({ statusCode: 400, statusMessage: 'Both selected lines must be existing "sum a field" summary lines' })
    }
  }

  const maxSort = await prisma.summaryFieldDefinition.aggregate({
    where: { businessId: session.businessId },
    _max: { sortOrder: true }
  })

  const created = await prisma.summaryFieldDefinition.create({
    data: {
      businessId: session.businessId,
      label: data.label,
      kind: data.kind,
      sourceKey: data.kind === 'SUM' ? data.sourceKey : null,
      statusTotalSummaryId: data.kind === 'STATUS' ? data.statusTotalSummaryId : null,
      statusPaidSummaryId: data.kind === 'STATUS' ? data.statusPaidSummaryId : null,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1
    }
  })

  return created
})
