import { z } from 'zod'
import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { logAudit } from '../../utils/audit'
import { getActiveFields, setFieldValues, getComputedFieldValues, findMissingRequiredFields } from '../../utils/fields'

const schema = z.object({
  originalAmount: z.number().positive().optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(2000).nullable().optional(),
  fields: z.record(z.string(), z.any()).optional()
})

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  const { fields: fieldValues, ...data } = parsed.data

  const existing = await prisma.payable.findFirst({ where: { id, businessId: session.businessId } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Payable not found' })

  const fieldDefs = await getActiveFields(session.businessId, 'PAYABLE')
  if (fieldValues) {
    const missingRequired = findMissingRequiredFields(fieldDefs, fieldValues)
    if (missingRequired.length) {
      throw createError({ statusCode: 400, statusMessage: `Missing required field(s): ${missingRequired.map(f => f.label).join(', ')}` })
    }
  }

  const updated = await prisma.payable.update({
    where: { id },
    data: {
      ...(data.originalAmount !== undefined ? { originalAmount: data.originalAmount } : {}),
      ...(data.dueDate !== undefined ? { dueDate: new Date(data.dueDate) } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {})
    }
  })

  if (fieldValues && fieldDefs.length) await setFieldValues(fieldDefs, id, fieldValues)
  const computedFields = fieldDefs.length ? await getComputedFieldValues(fieldDefs, id) : {}

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'Payable', entityId: id, action: 'UPDATE', before: existing, after: { updated, fields: computedFields } })

  return { ...updated, fields: computedFields }
})
