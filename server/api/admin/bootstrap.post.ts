import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { hashAdminPassword } from '../../utils/admin-auth'

const schema = z.object({
  secret: z.string(),
  name: z.string().min(1).max(150),
  email: z.string().email(),
  password: z.string().min(8)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })

  const expected = process.env.ADMIN_BOOTSTRAP_SECRET
  if (!expected || parsed.data.secret !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid bootstrap secret' })
  }

  // Only ever works once — prevents this endpoint from being usable to
  // create additional super admins later (that must go through the
  // regular sub-admin creation flow, gated by an existing super admin).
  const existingCount = await prisma.platformAdmin.count()
  if (existingCount > 0) {
    throw createError({ statusCode: 409, statusMessage: 'A platform admin already exists. This bootstrap endpoint only works once.' })
  }

  const passwordHash = await hashAdminPassword(parsed.data.password)
  const admin = await prisma.platformAdmin.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: 'SUPER_ADMIN',
      canViewUsers: true,
      canManageUserStatus: true,
      canDeleteUsers: true,
      canGenerateCodes: true,
      canManageSubAdmins: true
    }
  })

  return { success: true, admin: { id: admin.id, email: admin.email } }
})
