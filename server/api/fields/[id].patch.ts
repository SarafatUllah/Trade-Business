import { z } from 'zod'
import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { logAudit } from '../../utils/audit'

const schema = z.object({
  label: z.string().min(1).max(100).optional(),
  showInTable: z.boolean().optional(),
  showInInvoice: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
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

  const updated = await prisma.fieldDefinition.update({
    where: { id },
    data: {
      ...parsed.data,
      options: parsed.data.options ? JSON.stringify(parsed.data.options) : undefined
    }
  })

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'FieldDefinition', entityId: id, action: 'UPDATE', before: existing, after: updated })

  return updated
})
