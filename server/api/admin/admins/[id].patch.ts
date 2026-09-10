import { z } from 'zod'
import { requireSuperAdmin } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

const schema = z.object({
  isActive: z.boolean().optional(),
  canViewUsers: z.boolean().optional(),
  canManageUserStatus: z.boolean().optional(),
  canDeleteUsers: z.boolean().optional(),
  canGenerateCodes: z.boolean().optional(),
  canManageSubAdmins: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const superAdmin = await requireSuperAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })

  const target = await prisma.platformAdmin.findUnique({ where: { id } })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Admin not found' })
  if (target.role === 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Cannot modify another super admin' })
  }

  const updated = await prisma.platformAdmin.update({ where: { id }, data: parsed.data })

  await prisma.platformAuditLog.create({
    data: { adminId: superAdmin.id, action: 'UPDATE_SUB_ADMIN', targetType: 'PlatformAdmin', targetId: id, details: JSON.stringify(parsed.data) }
  })

  return { id: updated.id }
})
