import { z } from 'zod'
import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { logAudit } from '../../utils/audit'
import { validateFormula, resolveCalculationOrder, CircularDependencyError } from '../../utils/formula'

const schema = z.object({
  label: z.string().min(1).max(100).optional(),
  formula: z.string().max(500).optional(),
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

  const existing = await prisma.fieldDefinition.findFirst({ where: { id, businessId: session.businessId } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Field not found' })

  // Safety: a field cannot be archived if another active formula field
  // still depends on it — that would silently corrupt those calculations.
  if (parsed.data.isArchived === true) {
    const otherFormulas = await prisma.fieldDefinition.findMany({
      where: { businessId: session.businessId, type: 'FORMULA', isArchived: false, id: { not: id } }
    })
    const { extractDependencies } = await import('../../utils/formula')
    const dependents = otherFormulas.filter(f => extractDependencies(f.formula || '').includes(existing.key))
    if (dependents.length) {
      throw createError({
        statusCode: 409,
        statusMessage: `Cannot archive "${existing.label}" — used by formula field(s): ${dependents.map(d => d.label).join(', ')}`
      })
    }
  }

  // If editing a formula, re-validate it exactly as at creation time:
  // known field references only, and no new circular dependency.
  if (parsed.data.formula !== undefined && existing.type === 'FORMULA') {
    const allFields = await prisma.fieldDefinition.findMany({
      where: { businessId: session.businessId, entity: existing.entity, isArchived: false }
    })
    const knownKeys = allFields.map(f => f.key)
    const validation = validateFormula(parsed.data.formula, knownKeys)
    if (!validation.valid) throw createError({ statusCode: 400, statusMessage: validation.error })

    const otherFormulaFields = allFields
      .filter(f => f.type === 'FORMULA' && f.id !== id)
      .map(f => ({ key: f.key, formula: f.formula as string }))
    try {
      resolveCalculationOrder([...otherFormulaFields, { key: existing.key, formula: parsed.data.formula }])
    } catch (err) {
      if (err instanceof CircularDependencyError) throw createError({ statusCode: 400, statusMessage: err.message })
      throw err
    }
  }

  // Bug fix: archiving previously left the field's `key` untouched, but the
  // database's unique constraint on (businessId, entity, key) still applied
  // to archived rows — so re-adding a field with the same key later failed
  // with an opaque database error instead of working as expected. Freeing
  // the key on archive (while keeping the label/history intact) fixes this.
  const keyRename = parsed.data.isArchived === true && !existing.isArchived
    ? `${existing.key}__archived_${Date.now()}`
    : undefined

  const updated = await prisma.fieldDefinition.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(keyRename ? { key: keyRename } : {}),
      options: parsed.data.options ? JSON.stringify(parsed.data.options) : undefined
    }
  })

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'FieldDefinition', entityId: id, action: 'UPDATE', before: existing, after: updated })

  return updated
})
