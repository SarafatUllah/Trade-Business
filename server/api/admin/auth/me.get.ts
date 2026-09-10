import { getAdminSessionPayload } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const payload = getAdminSessionPayload(event)
  if (!payload) return { admin: null }

  const admin = await prisma.platformAdmin.findUnique({
    where: { id: payload.adminId },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      canViewUsers: true, canManageUserStatus: true, canDeleteUsers: true,
      canGenerateCodes: true, canManageSubAdmins: true
    }
  })
  if (!admin || !admin.isActive) return { admin: null }
  return { admin }
})
