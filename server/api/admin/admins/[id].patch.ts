import { z } from 'zod'
import { requireSuperAdmin } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

const schema = z.object({
  name: z.string().min(1).max(150).optional(),
  email: z.string().email().optional(),
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
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })

  const target = await prisma.platformAdmin.findUnique({ where: { id } })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Admin not found' })
  if (target.role === 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Cannot modify another super admin' })
  }

  if (parsed.data.email && parsed.data.email !== target.email) {
    const existing = await prisma.platformAdmin.findUnique({ where: { email: parsed.data.email } })
    if (existing) throw createError({ statusCode: 409, statusMessage: 'An admin with this email already exists' })
  }

  const updated = await prisma.platformAdmin.update({ where: { id }, data: parsed.data })

  await prisma.platformAuditLog.create({
    data: { adminId: superAdmin.id, action: 'UPDATE_SUB_ADMIN', targetType: 'PlatformAdmin', targetId: id, details: JSON.stringify(parsed.data) }
  })

  return {
    id: updated.id, name: updated.name, email: updated.email, isActive: updated.isActive,
    canViewUsers: updated.canViewUsers, canManageUserStatus: updated.canManageUserStatus,
    canDeleteUsers: updated.canDeleteUsers, canGenerateCodes: updated.canGenerateCodes,
    canManageSubAdmins: updated.canManageSubAdmins
  }
})
