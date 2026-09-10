import { requireSuperAdmin } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const superAdmin = await requireSuperAdmin(event)
  const id = getRouterParam(event, 'id')!

  if (id === superAdmin.id) {
    throw createError({ statusCode: 400, statusMessage: 'You cannot delete your own account' })
  }

  const target = await prisma.platformAdmin.findUnique({ where: { id } })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Admin not found' })
  if (target.role === 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Cannot delete another super admin' })
  }

  await prisma.platformAdmin.delete({ where: { id } })

  await prisma.platformAuditLog.create({
    data: { adminId: superAdmin.id, action: 'DELETE_SUB_ADMIN', targetType: 'PlatformAdmin', targetId: id, details: JSON.stringify({ email: target.email }) }
  })

  return { success: true }
})
