import { requirePermission } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'canDeleteUsers')
  const id = getRouterParam(event, 'id')!

  const business = await prisma.business.findUnique({ where: { id } })
  if (!business) throw createError({ statusCode: 404, statusMessage: 'Account not found' })

  // Cascading deletes (see schema: onDelete: Cascade on every business-
  // scoped relation) remove all of this business's data. Users who are
  // only members of this business are left as orphaned login records
  // (never auto-deleted — a user may in principle belong elsewhere).
  await prisma.business.delete({ where: { id } })

  await prisma.platformAuditLog.create({
    data: {
      adminId: admin.id,
      action: 'DELETE_BUSINESS',
      targetType: 'Business',
      targetId: id,
      details: JSON.stringify({ businessName: business.name })
    }
  })

  return { success: true }
})
