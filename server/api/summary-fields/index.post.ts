import { z } from 'zod'
import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { getActiveFields } from '../../utils/fields'

const schema = z.object({
  label: z.string().min(1).max(100),
  sourceKey: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const session = requireRole(event, 'STAFF')
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })

  // Only a field that can actually yield a number is summable — NUMBER,
  // CURRENCY, or FORMULA (which always resolves to a number).
  const activeFields = await getActiveFields(session.businessId, 'TRANSACTION')
  const sourceField = activeFields.find(f => f.key === parsed.data.sourceKey)
  if (!sourceField) throw createError({ statusCode: 400, statusMessage: 'That field was not found among active Ledger fields' })
  if (!['NUMBER', 'CURRENCY', 'FORMULA'].includes(sourceField.type)) {
    throw createError({ statusCode: 400, statusMessage: `"${sourceField.label}" is a ${sourceField.type} field and can't be summed — choose a Number, Currency, or Formula field` })
  }

  const maxSort = await prisma.summaryFieldDefinition.aggregate({
    where: { businessId: session.businessId },
    _max: { sortOrder: true }
  })

  const created = await prisma.summaryFieldDefinition.create({
    data: {
      businessId: session.businessId,
      label: parsed.data.label,
      sourceKey: parsed.data.sourceKey,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1
    }
  })

  return created
})
