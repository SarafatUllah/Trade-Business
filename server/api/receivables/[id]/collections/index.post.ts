import { z } from 'zod'
import { requireSession } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'
import { computeReceivableRemaining, isReceivableSettled } from '../../../../utils/status'
import { toApiNumber } from '../../../../utils/money'
import { logAudit } from '../../../../utils/audit'

const schema = z.object({
  amount: z.number().positive(),
  receivedAt: z.string().optional(),
  method: z.string().max(50).optional(),
  notes: z.string().max(1000).optional()
})

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const receivableId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })

  const result = await prisma.$transaction(async (tx) => {
    const receivable = await tx.receivable.findFirst({
      where: { id: receivableId, businessId: session.businessId },
      include: { collections: true }
    })
    if (!receivable) throw createError({ statusCode: 404, statusMessage: 'Receivable not found' })

    const collection = await tx.collection.create({
      data: {
        receivableId,
        amount: parsed.data.amount,
        receivedAt: parsed.data.receivedAt ? new Date(parsed.data.receivedAt) : new Date(),
        method: parsed.data.method,
        notes: parsed.data.notes,
        createdById: session.userId
      }
    })

    const updated = await tx.receivable.findFirst({ where: { id: receivableId }, include: { collections: true } })
    const settled = isReceivableSettled(updated!)
    await tx.receivable.update({ where: { id: receivableId }, data: { isSettled: settled } })
    if (settled) {
      await tx.reminder.updateMany({ where: { receivableId }, data: { isActive: false } })
    }

    return { collection, updated: updated!, settled }
  })

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'Collection', entityId: result.collection.id, action: 'CREATE', after: result.collection })

  return {
    collection: { id: result.collection.id, amount: toApiNumber(result.collection.amount), receivedAt: result.collection.receivedAt },
    remaining: toApiNumber(computeReceivableRemaining(result.updated)),
    settled: result.settled
  }
})
