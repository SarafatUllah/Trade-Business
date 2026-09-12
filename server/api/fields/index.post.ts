import { z } from 'zod'
import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { validateFormula, resolveCalculationOrder, CircularDependencyError } from '../../utils/formula'
import { logAudit } from '../../utils/audit'

const schema = z.object({
  entity: z.enum(['TRANSACTION', 'PAYABLE', 'RECEIVABLE']).default('TRANSACTION'),
  key: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Key must be snake_case, starting with a letter'),
  label: z.string().min(1).max(100),
  type: z.enum(['TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'DATETIME', 'DROPDOWN', 'STATUS', 'BOOLEAN', 'FORMULA', 'AUTO_STATUS']),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  formula: z.string().max(500).optional(),
  statusTotalKey: z.string().optional(),
  statusPaidKey: z.string().optional(),
  isRequired: z.boolean().optional(),
  showInTable: z.boolean().optional(),
  showInInvoice: z.boolean().optional(),
  isFilterable: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const session = requireRole(event, 'STAFF')
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  const data = parsed.data

  const existingFields = await prisma.fieldDefinition.findMany({
    where: { businessId: session.businessId, entity: data.entity, isArchived: false }
  })

  if (existingFields.some(f => f.key === data.key)) {
    throw createError({ statusCode: 409, statusMessage: `A field with key "${data.key}" already exists` })
  }

  if (data.type === 'FORMULA') {
    if (!data.formula) throw createError({ statusCode: 400, statusMessage: 'Formula fields require a formula expression' })
    const knownKeys = [...existingFields.map(f => f.key), data.key]
    const validation = validateFormula(data.formula, knownKeys)
    if (!validation.valid) throw createError({ statusCode: 400, statusMessage: validation.error })

    // Simulate adding this field and ensure no circular dependency results.
    const allFormulaFields = [
      ...existingFields.filter(f => f.type === 'FORMULA').map(f => ({ key: f.key, formula: f.formula as string })),
      { key: data.key, formula: data.formula }
    ]
    try {
      resolveCalculationOrder(allFormulaFields)
    } catch (err) {
      if (err instanceof CircularDependencyError) {
        throw createError({ statusCode: 400, statusMessage: err.message })
      }
      throw err
    }
  }

  if (data.type === 'AUTO_STATUS') {
    if (!data.statusTotalKey || !data.statusPaidKey) {
      throw createError({ statusCode: 400, statusMessage: 'A Payment Status field needs both a total/due field and a paid field selected' })
    }
    const summableTypes = ['NUMBER', 'CURRENCY', 'FORMULA']
    const totalField = existingFields.find(f => f.key === data.statusTotalKey)
    const paidField = existingFields.find(f => f.key === data.statusPaidKey)
    if (!totalField || !summableTypes.includes(totalField.type)) {
      throw createError({ statusCode: 400, statusMessage: 'The total/due field must be an existing Number, Currency, or Formula field' })
    }
    if (!paidField || !summableTypes.includes(paidField.type)) {
      throw createError({ statusCode: 400, statusMessage: 'The paid field must be an existing Number, Currency, or Formula field' })
    }
  }

  const maxOrder = existingFields.reduce((m, f) => Math.max(m, f.sortOrder), -1)

  const field = await prisma.fieldDefinition.create({
    data: {
      businessId: session.businessId,
      entity: data.entity,
      key: data.key,
      label: data.label,
      type: data.type,
      options: data.options ? JSON.stringify(data.options) : null,
      formula: data.formula ?? null,
      statusTotalKey: data.type === 'AUTO_STATUS' ? data.statusTotalKey : null,
      statusPaidKey: data.type === 'AUTO_STATUS' ? data.statusPaidKey : null,
      isRequired: data.isRequired ?? false,
      showInTable: data.showInTable ?? true,
      showInInvoice: data.showInInvoice ?? false,
      isFilterable: data.isFilterable ?? false,
      sortOrder: maxOrder + 1
    }
  })

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'FieldDefinition', entityId: field.id, action: 'CREATE', after: field })

  return field
})
