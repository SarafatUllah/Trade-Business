import { z } from 'zod'
import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { logAudit } from '../../utils/audit'

const schema = z.object({
  partyId: z.string(),
  originalAmount: z.number().positive(),
  dueDate: z.string(),
  notes: z.string().max(2000).optional(),
  transactionId: z.string().optional(),
  reminderDaysBefore: z.array(z.number().int()).optional() // e.g. [0,1,2,3,7]
})

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  const { reminderDaysBefore, ...data } = parsed.data

  const party = await prisma.party.findFirst({ where: { id: data.partyId, businessId: session.businessId } })
  if (!party) throw createError({ statusCode: 404, statusMessage: 'Party not found' })

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

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'Payable', entityId: payable.id, action: 'CREATE', after: payable })

  return payable
})
