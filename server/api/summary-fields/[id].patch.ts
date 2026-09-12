import { z } from 'zod'
import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { getActiveFields } from '../../utils/fields'

const schema = z.object({
  label: z.string().min(1).max(100).optional(),
  sourceKey: z.string().min(1).optional(),
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

  if (parsed.data.sourceKey) {
    const activeFields = await getActiveFields(session.businessId, 'TRANSACTION')
    const sourceField = activeFields.find(f => f.key === parsed.data.sourceKey)
    if (!sourceField) throw createError({ statusCode: 400, statusMessage: 'That field was not found among active Ledger fields' })
    if (!['NUMBER', 'CURRENCY', 'FORMULA'].includes(sourceField.type)) {
      throw createError({ statusCode: 400, statusMessage: `"${sourceField.label}" is a ${sourceField.type} field and can't be summed — choose a Number, Currency, or Formula field` })
    }
  }

  const updated = await prisma.summaryFieldDefinition.update({ where: { id }, data: parsed.data })
  return updated
})
