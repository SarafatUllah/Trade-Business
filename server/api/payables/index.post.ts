import { z } from 'zod'
import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { logAudit } from '../../utils/audit'
import { getActiveFields, setFieldValues, getComputedFieldValues, findMissingRequiredFields } from '../../utils/fields'

const schema = z.object({
  partyId: z.string(),
  originalAmount: z.number().positive(),
  dueDate: z.string(),
  notes: z.string().max(2000).optional(),
  transactionId: z.string().optional(),
  reminderDaysBefore: z.array(z.number().int()).optional(), // e.g. [0,1,2,3,7]
  fields: z.record(z.string(), z.any()).optional() // custom PAYABLE-entity field values
})

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  const { reminderDaysBefore, fields: fieldValues = {}, ...data } = parsed.data

  const party = await prisma.party.findFirst({ where: { id: data.partyId, businessId: session.businessId } })
  if (!party) throw createError({ statusCode: 404, statusMessage: 'Party not found' })
  if (party.type !== 'BUYER') {
    throw createError({ statusCode: 400, statusMessage: `"${party.name}" is marked as a Seller — Payables can only be created for Buyer-type parties.` })
  }

  const fieldDefs = await getActiveFields(session.businessId, 'PAYABLE')
  const missingRequired = findMissingRequiredFields(fieldDefs, fieldValues)
  if (missingRequired.length) {
    throw createError({ statusCode: 400, statusMessage: `Missing required field(s): ${missingRequired.map(f => f.label).join(', ')}` })
  }

  const payable = await prisma.$transaction(async (tx) => {
    const created = await tx.payable.create({
      data: {
        businessId: session.businessId,
        partyId: data.partyId,
        originalAmount: data.originalAmount,
        dueDate: new Date(data.dueDate),
        notes: data.notes,
        transactionId: data.transactionId
      }
    })
    for (const days of reminderDaysBefore ?? [1, 0]) {
      await tx.reminder.create({
        data: { businessId: session.businessId, obligationType: 'PAYABLE', payableId: created.id, daysBefore: days }
      })
    }
    return created
  })

  if (fieldDefs.length) await setFieldValues(fieldDefs, payable.id, fieldValues)
  const computedFields = fieldDefs.length ? await getComputedFieldValues(fieldDefs, payable.id) : {}

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'Payable', entityId: payable.id, action: 'CREATE', after: { payable, fields: computedFields } })

  return { ...payable, fields: computedFields }
})
