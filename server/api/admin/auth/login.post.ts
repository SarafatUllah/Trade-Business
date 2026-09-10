import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { verifyAdminPassword, signAdminSession, setAdminSessionCookie } from '../../../utils/admin-auth'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })

  const admin = await prisma.platformAdmin.findUnique({ where: { email: parsed.data.email } })
  if (!admin || !admin.isActive) throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })

  const ok = await verifyAdminPassword(parsed.data.password, admin.passwordHash)
  if (!ok) throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })

  const token = signAdminSession(event, { adminId: admin.id })
  setAdminSessionCookie(event, token)

  return {
    admin: {
      id: admin.id, name: admin.name, email: admin.email, role: admin.role,
      canViewUsers: admin.canViewUsers, canManageUserStatus: admin.canManageUserStatus,
      canDeleteUsers: admin.canDeleteUsers, canGenerateCodes: admin.canGenerateCodes,
      canManageSubAdmins: admin.canManageSubAdmins
    }
  }
})
