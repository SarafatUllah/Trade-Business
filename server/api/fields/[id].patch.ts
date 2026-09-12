import { z } from 'zod'
import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { logAudit } from '../../utils/audit'
import { validateFormula, resolveCalculationOrder, extractDependencies, CircularDependencyError } from '../../utils/formula'

const FIELD_TYPES = ['TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'DATETIME', 'DROPDOWN', 'STATUS', 'BOOLEAN', 'FORMULA', 'AUTO_STATUS'] as const

const schema = z.object({
  label: z.string().min(1).max(100).optional(),
  key: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Key must be snake_case, starting with a letter').optional(),
  type: z.enum(FIELD_TYPES).optional(),
  formula: z.string().max(500).optional(),
  statusTotalKey: z.string().optional(),
  statusPaidKey: z.string().optional(),
  showInTable: z.boolean().optional(),
  showInInvoice: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  isArchived: z.boolean().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional()
})

export default defineEventHandler(async (event) => {
  const session = requireRole(event, 'STAFF')
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  const data = parsed.data

  const existing = await prisma.fieldDefinition.findFirst({ where: { id, businessId: session.businessId } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Field not found' })

  const allActiveFields = await prisma.fieldDefinition.findMany({
    where: { businessId: session.businessId, entity: existing.entity, isArchived: false }
  })
  const dependentFormulas = allActiveFields.filter(
    f => f.type === 'FORMULA' && f.id !== id && extractDependencies(f.formula || '').includes(existing.key)
  )
  // AUTO_STATUS fields reference two other fields by key (not via formula
  // text), so they need their own dependency check — same reasoning as
  // formulas: renaming/archiving the referenced field would otherwise
  // silently break the status calculation.
  const dependentAutoStatus = allActiveFields.filter(
    f => f.type === 'AUTO_STATUS' && f.id !== id && (f.statusTotalKey === existing.key || f.statusPaidKey === existing.key)
  )
  const allDependents = [...dependentFormulas, ...dependentAutoStatus]

  // Safety: a field cannot be archived, renamed, or have its type changed
  // away from FORMULA while another active formula (or AUTO_STATUS field)
  // still depends on its current key — any of those would silently break
  // those calculations.
  const removingAsCalculableReference =
    data.isArchived === true ||
    (data.key !== undefined && data.key !== existing.key) ||
    (data.type !== undefined && data.type !== existing.type && existing.type === 'FORMULA' && data.type !== 'FORMULA')

  if (removingAsCalculableReference && allDependents.length) {
    // Renaming is actually safe IF we cascade the rename into dependents'
    // formula text / status references (handled below) — only block
    // archiving or a type change away from FORMULA, which have no safe
    // automatic fix.
    const isJustARename = data.key !== undefined && data.key !== existing.key &&
      data.isArchived !== true && !(data.type !== undefined && data.type !== existing.type)
    if (!isJustARename) {
      throw createError({
        statusCode: 409,
        statusMessage: `Cannot do this to "${existing.label}" — used by: ${allDependents.map(d => d.label).join(', ')}`
      })
    }
  }

  // Key uniqueness check (only against other *active* fields — archived
  // fields have their key freed already, see the archive branch below).
  if (data.key !== undefined && data.key !== existing.key) {
    if (allActiveFields.some(f => f.id !== id && f.key === data.key)) {
      throw createError({ statusCode: 409, statusMessage: `A field with key "${data.key}" already exists` })
    }
  }

  // If editing a formula, re-validate it exactly as at creation time:
  // known field references only, and no new circular dependency.
  if (data.formula !== undefined && (data.type === 'FORMULA' || (data.type === undefined && existing.type === 'FORMULA'))) {
    const knownKeys = allActiveFields.map(f => f.key)
    const validation = validateFormula(data.formula, knownKeys)
    if (!validation.valid) throw createError({ statusCode: 400, statusMessage: validation.error })

    const otherFormulaFields = allActiveFields
      .filter(f => f.type === 'FORMULA' && f.id !== id)
      .map(f => ({ key: f.key, formula: f.formula as string }))
    try {
      resolveCalculationOrder([...otherFormulaFields, { key: data.key ?? existing.key, formula: data.formula }])
    } catch (err) {
      if (err instanceof CircularDependencyError) throw createError({ statusCode: 400, statusMessage: err.message })
      throw err
    }
  }

  // If (re)configuring AUTO_STATUS, validate its two references the same
  // way creation does.
  const becomingAutoStatus = data.type === 'AUTO_STATUS' || (data.type === undefined && existing.type === 'AUTO_STATUS')
  if (becomingAutoStatus && (data.statusTotalKey !== undefined || data.statusPaidKey !== undefined || data.type === 'AUTO_STATUS')) {
    const totalKey = data.statusTotalKey ?? existing.statusTotalKey
    const paidKey = data.statusPaidKey ?? existing.statusPaidKey
    if (!totalKey || !paidKey) {
      throw createError({ statusCode: 400, statusMessage: 'A Payment Status field needs both a total/due field and a paid field selected' })
    }
    const summableTypes = ['NUMBER', 'CURRENCY', 'FORMULA']
    const totalField = allActiveFields.find(f => f.key === totalKey)
    const paidField = allActiveFields.find(f => f.key === paidKey)
    if (!totalField || !summableTypes.includes(totalField.type)) {
      throw createError({ statusCode: 400, statusMessage: 'The total/due field must be an existing Number, Currency, or Formula field' })
    }
    if (!paidField || !summableTypes.includes(paidField.type)) {
      throw createError({ statusCode: 400, statusMessage: 'The paid field must be an existing Number, Currency, or Formula field' })
    }
  }

  // Bug fix: archiving previously left the field's `key` untouched, but the
  // database's unique constraint on (businessId, entity, key) still applied
  // to archived rows — so re-adding a field with the same key later failed
  // with an opaque database error instead of working as expected. Freeing
  // the key on archive (while keeping the label/history intact) fixes this.
  const archiveKeyRename = data.isArchived === true && !existing.isArchived
    ? `${existing.key}__archived_${Date.now()}`
    : undefined

  const finalKey = archiveKeyRename ?? data.key

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.fieldDefinition.update({
      where: { id },
      data: {
        ...data,
        ...(finalKey ? { key: finalKey } : {}),
        options: data.options ? JSON.stringify(data.options) : undefined
      }
    })

    // Cascade a key rename into every dependent formula's stored text, and
    // every dependent AUTO_STATUS field's total/paid reference, so they
    // keep working under the new name instead of silently breaking.
    if (data.key !== undefined && data.key !== existing.key && allDependents.length) {
      const wordBoundary = new RegExp(`\\b${existing.key}\\b`, 'g')
      for (const dep of dependentFormulas) {
        await tx.fieldDefinition.update({
          where: { id: dep.id },
          data: { formula: (dep.formula || '').replace(wordBoundary, data.key!) }
        })
      }
      for (const dep of dependentAutoStatus) {
        await tx.fieldDefinition.update({
          where: { id: dep.id },
          data: {
            statusTotalKey: dep.statusTotalKey === existing.key ? data.key : dep.statusTotalKey,
            statusPaidKey: dep.statusPaidKey === existing.key ? data.key : dep.statusPaidKey
          }
        })
      }
    }

    // If the type changed, migrate existing stored values into the
    // correct typed column so old data isn't silently orphaned/hidden.
    if (data.type !== undefined && data.type !== existing.type) {
      const values = await tx.customFieldValue.findMany({ where: { fieldId: id } })
      for (const v of values) {
        const raw = v.stringValue ?? (v.numberValue !== null ? v.numberValue.toString() : null) ??
          (v.dateValue ? v.dateValue.toISOString() : null) ?? (v.boolValue !== null ? String(v.boolValue) : null)
        const next: Record<string, unknown> = { stringValue: null, numberValue: null, dateValue: null, boolValue: null }
        if (raw !== null) {
          if (data.type === 'NUMBER' || data.type === 'CURRENCY') {
            const n = Number(raw)
            if (!Number.isNaN(n)) next.numberValue = n
          } else if (data.type === 'DATE' || data.type === 'DATETIME') {
            const d = new Date(raw)
            if (!Number.isNaN(d.getTime())) next.dateValue = d
          } else if (data.type === 'BOOLEAN') {
            next.boolValue = raw === 'true' || raw === '1'
          } else {
            next.stringValue = raw
          }
        }
        await tx.customFieldValue.update({ where: { id: v.id }, data: next })
      }
    }

    return updated
  })

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'FieldDefinition', entityId: id, action: 'UPDATE', before: existing, after: result })

  return result
})
