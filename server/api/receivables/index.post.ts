import { z } from 'zod'
import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { logAudit } from '../../utils/audit'
import { getActiveFields, setFieldValues, getComputedFieldValues } from '../../utils/fields'

const schema = z.object({
  partyId: z.string(),
  originalAmount: z.number().positive(),
  expectedDate: z.string(),
  notes: z.string().max(2000).optional(),
  transactionId: z.string().optional(),
  reminderDaysBefore: z.array(z.number().int()).optional(),
  fields: z.record(z.string(), z.any()).optional() // custom RECEIVABLE-entity field values
})

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  const { reminderDaysBefore, fields: fieldValues = {}, ...data } = parsed.data

  const party = await prisma.party.findFirst({ where: { id: data.partyId, businessId: session.businessId } })
  if (!party) throw createError({ statusCode: 404, statusMessage: 'Party not found' })

  const fieldDefs = await getActiveFields(session.businessId, 'RECEIVABLE')
  const missingRequired = fieldDefs.filter(f => f.isRequired && f.type !== 'FORMULA' && !(f.key in fieldValues))
  if (missingRequired.length) {
    throw createError({ statusCode: 400, statusMessage: `Missing required field(s): ${missingRequired.map(f => f.label).join(', ')}` })
  }

  const receivable = await prisma.$transaction(async (tx) => {
    const created = await tx.receivable.create({
      data: {
        businessId: session.businessId,
        partyId: data.partyId,
        originalAmount: data.originalAmount,
        expectedDate: new Date(data.expectedDate),
        notes: data.notes,
        transactionId: data.transactionId
      }
    })
    for (const days of reminderDaysBefore ?? [1, 0]) {
      await tx.reminder.create({
        data: { businessId: session.businessId, obligationType: 'RECEIVABLE', receivableId: created.id, daysBefore: days }
      })
    }
    return created
  })

  if (fieldDefs.length) await setFieldValues(fieldDefs, receivable.id, fieldValues)
  const computedFields = fieldDefs.length ? await getComputedFieldValues(fieldDefs, receivable.id) : {}

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'Receivable', entityId: receivable.id, action: 'CREATE', after: { receivable, fields: computedFields } })

  return { ...receivable, fields: computedFields }
})
