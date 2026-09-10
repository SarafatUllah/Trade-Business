import { requirePermission } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'canManageSubAdmins')

  const admins = await prisma.platformAdmin.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      canViewUsers: true, canManageUserStatus: true, canDeleteUsers: true,
      canGenerateCodes: true, canManageSubAdmins: true, createdAt: true,
      createdBy: { select: { name: true } }
    }
  })
  return admins
})
