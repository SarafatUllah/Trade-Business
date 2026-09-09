import { z } from 'zod'
import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { getActiveFields, setFieldValues, getComputedFieldValues } from '../../utils/fields'
import { logAudit } from '../../utils/audit'

const schema = z.object({
  date: z.string().optional(),
  partyId: z.string().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  fields: z.record(z.any()).optional()
})

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })

  const existing = await prisma.transaction.findFirst({ where: { id, businessId: session.businessId } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })

  const { fields: fieldValues, ...core } = parsed.data
  const transaction = await prisma.transaction.update({
    where: { id },
    data: {
      ...(core.date ? { date: new Date(core.date) } : {}),
      ...(core.partyId !== undefined ? { partyId: core.partyId } : {}),
      ...(core.description !== undefined ? { description: core.description } : {})
    }
  })

  const fieldDefs = await getActiveFields(session.businessId, 'TRANSACTION')
  if (fieldValues) await setFieldValues(fieldDefs, id, fieldValues)
  const computed = await getComputedFieldValues(fieldDefs, id)

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'Transaction', entityId: id, action: 'UPDATE', before: existing, after: { transaction, fields: computed } })

  return { ...transaction, fields: computed }
})
