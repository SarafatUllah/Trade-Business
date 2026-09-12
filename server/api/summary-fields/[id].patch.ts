import { z } from 'zod'
import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { getActiveFields } from '../../utils/fields'

const schema = z.object({
  label: z.string().min(1).max(100).optional(),
  kind: z.enum(['SUM', 'STATUS']).optional(),
  sourceKey: z.string().min(1).optional(),
  statusTotalSummaryId: z.string().min(1).optional(),
  statusPaidSummaryId: z.string().min(1).optional(),
  sortOrder: z.number().int().optional()
})

export default defineEventHandler(async (event) => {
  const session = requireRole(event, 'STAFF')
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })

  const existing = await prisma.summaryFieldDefinition.findFirst({ where: { id, businessId: session.businessId } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Summary field not found' })

  const effectiveKind = parsed.data.kind ?? existing.kind

  if (effectiveKind === 'SUM' && parsed.data.sourceKey) {
    const activeFields = await getActiveFields(session.businessId, 'TRANSACTION')
    const sourceField = activeFields.find(f => f.key === parsed.data.sourceKey)
    if (!sourceField) throw createError({ statusCode: 400, statusMessage: 'That field was not found among active Ledger fields' })
    if (!['NUMBER', 'CURRENCY', 'FORMULA'].includes(sourceField.type)) {
      throw createError({ statusCode: 400, statusMessage: `"${sourceField.label}" is a ${sourceField.type} field and can't be summed — choose a Number, Currency, or Formula field` })
    }
  }

  if (effectiveKind === 'STATUS') {
    const totalId = parsed.data.statusTotalSummaryId ?? existing.statusTotalSummaryId
    const paidId = parsed.data.statusPaidSummaryId ?? existing.statusPaidSummaryId
    if (!totalId || !paidId) {
      throw createError({ statusCode: 400, statusMessage: 'A Payment Status summary line needs both a Total line and a Paid line selected' })
    }
    // A STATUS line can't reference itself (would be a trivial/circular
    // comparison) and both references must be real SUM lines.
    if (totalId === id || paidId === id) {
      throw createError({ statusCode: 400, statusMessage: 'A summary line cannot reference itself' })
    }
    const existingSums = await prisma.summaryFieldDefinition.findMany({
      where: { businessId: session.businessId, kind: 'SUM', id: { in: [totalId, paidId] } }
    })
    if (existingSums.length !== 2) {
      throw createError({ statusCode: 400, statusMessage: 'Both selected lines must be existing "sum a field" summary lines' })
    }
  }

  // If switching kind, clear whichever fields no longer apply so a stale
  // sourceKey/statusXSummaryId from before the switch can't linger.
  const kindSwitchCleanup = parsed.data.kind
    ? (parsed.data.kind === 'SUM'
        ? { statusTotalSummaryId: null, statusPaidSummaryId: null }
        : { sourceKey: null })
    : {}

  const updated = await prisma.summaryFieldDefinition.update({
    where: { id },
    data: { ...parsed.data, ...kindSwitchCleanup }
  })
  return updated
})
