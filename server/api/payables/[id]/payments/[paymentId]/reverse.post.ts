import { z } from 'zod'
import { requireRole } from '../../../../../utils/auth'
import { prisma } from '../../../../../utils/prisma'
import { logAudit } from '../../../../../utils/audit'

const schema = z.object({ reason: z.string().min(1).max(500) })

export default defineEventHandler(async (event) => {
  const session = requireRole(event, 'ADMIN')
  const payableId = getRouterParam(event, 'id')!
  const paymentId = getRouterParam(event, 'paymentId')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A reversal reason is required' })

  const payment = await prisma.payment.findFirst({ where: { id: paymentId, payableId } })
  if (!payment) throw createError({ statusCode: 404, statusMessage: 'Payment not found' })
  if (payment.reversedAt) throw createError({ statusCode: 409, statusMessage: 'Payment already reversed' })

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: { reversedAt: new Date(), reversalReason: parsed.data.reason }
  })

  await prisma.payable.update({ where: { id: payableId }, data: { isSettled: false } })
  await prisma.reminder.updateMany({ where: { payableId }, data: { isActive: true } })

  await logAudit({
    businessId: session.businessId,
    userId: session.userId,
    entity: 'Payment',
    entityId: paymentId,
    action: 'REVERSE',
    before: payment,
    after: updated
  })

  return { success: true }
})
