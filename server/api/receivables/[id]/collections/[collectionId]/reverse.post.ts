import { z } from 'zod'
import { requireRole } from '../../../../../utils/auth'
import { prisma } from '../../../../../utils/prisma'
import { logAudit } from '../../../../../utils/audit'

const schema = z.object({ reason: z.string().min(1).max(500) })

export default defineEventHandler(async (event) => {
  const session = requireRole(event, 'ADMIN')
  const receivableId = getRouterParam(event, 'id')!
  const collectionId = getRouterParam(event, 'collectionId')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A reversal reason is required' })

  const collection = await prisma.collection.findFirst({ where: { id: collectionId, receivableId } })
  if (!collection) throw createError({ statusCode: 404, statusMessage: 'Collection not found' })
  if (collection.reversedAt) throw createError({ statusCode: 409, statusMessage: 'Collection already reversed' })

  const updated = await prisma.collection.update({
    where: { id: collectionId },
    data: { reversedAt: new Date(), reversalReason: parsed.data.reason }
  })

  await prisma.receivable.update({ where: { id: receivableId }, data: { isSettled: false } })
  await prisma.reminder.updateMany({ where: { receivableId }, data: { isActive: true } })

  await logAudit({
    businessId: session.businessId,
    userId: session.userId,
    entity: 'Collection',
    entityId: collectionId,
    action: 'REVERSE',
    before: collection,
    after: updated
  })

  return { success: true }
})
