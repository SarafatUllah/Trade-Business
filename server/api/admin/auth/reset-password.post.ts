import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { prisma } from '../../../utils/prisma'
import { hashAdminPassword } from '../../../utils/admin-auth'

const schema = z.object({
  token: z.string(),
  newPassword: z.string().min(8)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })

  const config = useRuntimeConfig(event)
  let payload: { adminId: string; purpose: string }
  try {
    payload = jwt.verify(parsed.data.token, `${config.jwtSecret}::admin`) as { adminId: string; purpose: string }
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'This reset link is invalid or has expired. Request a new one.' })
  }
  if (payload.purpose !== 'admin_password_reset') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid reset token' })
  }

  const admin = await prisma.platformAdmin.findUnique({ where: { id: payload.adminId } })
  if (!admin || !admin.isActive) {
    throw createError({ statusCode: 400, statusMessage: 'This reset link is invalid or has expired. Request a new one.' })
  }

  const passwordHash = await hashAdminPassword(parsed.data.newPassword)
  await prisma.platformAdmin.update({ where: { id: admin.id }, data: { passwordHash } })

  return { success: true }
})
