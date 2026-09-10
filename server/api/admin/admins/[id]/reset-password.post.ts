import { z } from 'zod'
import { requireSuperAdmin, hashAdminPassword } from '../../../../utils/admin-auth'
import { prisma } from '../../../../utils/prisma'

const schema = z.object({ newPassword: z.string().min(8) })

export default defineEventHandler(async (event) => {
  const superAdmin = await requireSuperAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })

  const target = await prisma.platformAdmin.findUnique({ where: { id } })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Admin not found' })
  if (target.role === 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Cannot reset another super admin\'s password this way — use forgot password instead' })
  }

  const passwordHash = await hashAdminPassword(parsed.data.newPassword)
  await prisma.platformAdmin.update({ where: { id }, data: { passwordHash } })

  await prisma.platformAuditLog.create({
    data: { adminId: superAdmin.id, action: 'RESET_SUB_ADMIN_PASSWORD', targetType: 'PlatformAdmin', targetId: id }
  })

  return { success: true }
})
