import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { prisma } from '../../utils/prisma'
import { hashPassword } from '../../utils/auth'
import { logAudit } from '../../utils/audit'

const schema = z.object({
  token: z.string(),
  newPassword: z.string().min(8)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })

  const config = useRuntimeConfig(event)
  let payload: { userId: string; purpose: string }
  try {
    payload = jwt.verify(parsed.data.token, config.jwtSecret) as { userId: string; purpose: string }
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'This reset link is invalid or has expired. Request a new one.' })
  }
  if (payload.purpose !== 'password_reset') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid reset token' })
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, include: { memberships: { take: 1 } } })
  if (!user) throw createError({ statusCode: 400, statusMessage: 'This reset link is invalid or has expired. Request a new one.' })

  const passwordHash = await hashPassword(parsed.data.newPassword)
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

  const businessId = user.memberships[0]?.businessId
  if (businessId) {
    await logAudit({ businessId, userId: user.id, entity: 'User', entityId: user.id, action: 'UPDATE', after: { passwordChanged: true } })
  }

  return { success: true }
})
