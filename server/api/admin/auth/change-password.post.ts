import { z } from 'zod'
import { requireAdmin, verifyAdminPassword, hashAdminPassword } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })

  const ok = await verifyAdminPassword(parsed.data.currentPassword, admin.passwordHash)
  if (!ok) throw createError({ statusCode: 401, statusMessage: 'Current password is incorrect' })

  const passwordHash = await hashAdminPassword(parsed.data.newPassword)
  await prisma.platformAdmin.update({ where: { id: admin.id }, data: { passwordHash } })

  return { success: true }
})
