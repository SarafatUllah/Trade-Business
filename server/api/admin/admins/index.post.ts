import { z } from 'zod'
import { requireSuperAdmin, hashAdminPassword } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

const schema = z.object({
  name: z.string().min(1).max(150),
  email: z.string().email(),
  password: z.string().min(8),
  canViewUsers: z.boolean().default(true),
  canManageUserStatus: z.boolean().default(false),
  canDeleteUsers: z.boolean().default(false),
  canGenerateCodes: z.boolean().default(false),
  canManageSubAdmins: z.boolean().default(false)
})

export default defineEventHandler(async (event) => {
  // Only a SUPER_ADMIN may create sub-admins — this is intentionally not
  // just a permission flag, since granting "canManageSubAdmins" to a
  // sub-admin would otherwise let them create sub-admins with equal or
  // greater privilege than themselves.
  const superAdmin = await requireSuperAdmin(event)
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  const data = parsed.data

  const existing = await prisma.platformAdmin.findUnique({ where: { email: data.email } })
  if (existing) throw createError({ statusCode: 409, statusMessage: 'An admin with this email already exists' })

  const passwordHash = await hashAdminPassword(data.password)
  const created = await prisma.platformAdmin.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: 'SUB_ADMIN',
      createdById: superAdmin.id,
      canViewUsers: data.canViewUsers,
      canManageUserStatus: data.canManageUserStatus,
      canDeleteUsers: data.canDeleteUsers,
      canGenerateCodes: data.canGenerateCodes,
      canManageSubAdmins: data.canManageSubAdmins
    }
  })

  await prisma.platformAuditLog.create({
    data: { adminId: superAdmin.id, action: 'CREATE_SUB_ADMIN', targetType: 'PlatformAdmin', targetId: created.id, details: JSON.stringify({ email: data.email }) }
  })

  return { id: created.id, name: created.name, email: created.email }
})
