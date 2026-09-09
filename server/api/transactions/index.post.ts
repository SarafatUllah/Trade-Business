import { z } from 'zod'
import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { getActiveFields, setFieldValues, getComputedFieldValues } from '../../utils/fields'
import { logAudit } from '../../utils/audit'

const schema = z.object({
  date: z.string(),
  partyId: z.string().optional(),
  description: z.string().max(500).optional(),
  fields: z.record(z.string(), z.any()).optional()
})

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  const { date, partyId, description, fields: fieldValues = {} } = parsed.data

  const fieldDefs = await getActiveFields(session.businessId, 'TRANSACTION')

  const missingRequired = fieldDefs.filter(f => f.isRequired && f.type !== 'FORMULA' && !(f.key in fieldValues))
  if (missingRequired.length) {
    throw createError({ statusCode: 400, statusMessage: `Missing required field(s): ${missingRequired.map(f => f.label).join(', ')}` })
  }

  const transaction = await prisma.transaction.create({
    data: { businessId: session.businessId, date: new Date(date), partyId, description, createdById: session.userId }
  })

  await setFieldValues(fieldDefs, transaction.id, fieldValues)
  const computed = await getComputedFieldValues(fieldDefs, transaction.id)

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'Transaction', entityId: transaction.id, action: 'CREATE', after: { transaction, fields: computed } })

  return { ...transaction, fields: computed }
})
