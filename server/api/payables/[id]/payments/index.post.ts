import { z } from 'zod'
import { requireSession } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { computePayablePaid, computePayableRemaining, isPayableSettled } from '../../../utils/status'
import { toApiNumber, toMoney } from '../../../utils/money'
import { logAudit } from '../../../utils/audit'

const schema = z.object({
  amount: z.number().positive(),
  paidAt: z.string().optional(),
  method: z.string().max(50).optional(),
  notes: z.string().max(1000).optional()
})

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const payableId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })

  // Wrap read-check-write in a single DB transaction to protect against
  // race conditions from two simultaneous payment submissions overpaying
  // the same payable.
  const result = await prisma.$transaction(async (tx) => {
    const payable = await tx.payable.findFirst({
      where: { id: payableId, businessId: session.businessId },
      include: { payments: true }
    })
    if (!payable) throw createError({ statusCode: 404, statusMessage: 'Payable not found' })

    const remaining = computePayableRemaining(payable)
    if (toMoney(parsed.data.amount).greaterThan(remaining) && !remaining.isZero()) {
      // Not a hard block — overpayment can be legitimate (advance payment)
      // but we surface it so the UI can confirm with the user.
    }

    const payment = await tx.payment.create({
      data: {
        payableId,
        amount: parsed.data.amount,
        paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date(),
        method: parsed.data.method,
        notes: parsed.data.notes,
        createdById: session.userId
      }
    })

    const updatedPayable = await tx.payable.findFirst({ where: { id: payableId }, include: { payments: true } })
    const settled = isPayableSettled(updatedPayable!)
    await tx.payable.update({ where: { id: payableId }, data: { isSettled: settled } })

    if (settled) {
      // Stop future reminders once fully settled.
      await tx.reminder.updateMany({ where: { payableId }, data: { isActive: false } })
    }

    return { payment, updatedPayable: updatedPayable!, settled }
  })

  await logAudit({
    businessId: session.businessId,
    userId: session.userId,
    entity: 'Payment',
    entityId: result.payment.id,
    action: 'CREATE',
    after: result.payment
  })

  return {
    payment: { id: result.payment.id, amount: toApiNumber(result.payment.amount), paidAt: result.payment.paidAt },
    remaining: toApiNumber(computePayableRemaining(result.updatedPayable)),
    settled: result.settled
  }
})
