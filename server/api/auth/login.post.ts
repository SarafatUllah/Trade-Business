import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { verifyPassword, signSession, setSessionCookie } from '../../utils/auth'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }
  const { email, password, remember = true } = parsed.data

  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { business: true }, take: 1, orderBy: { createdAt: 'asc' } } }
  })
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })

  const membership = user.memberships[0]
  if (!membership) throw createError({ statusCode: 403, statusMessage: 'No business associated with this account' })

  if (membership.business.accountStatus === 'DEACTIVATED') {
    throw createError({
      statusCode: 403,
      statusMessage: 'This account has been deactivated. Please contact your administrator to reactivate it (e.g. after completing payment or your free trial has ended).'
    })
  }

  const token = signSession(event, { userId: user.id, businessId: membership.businessId, role: membership.role }, remember)
  setSessionCookie(event, token, remember)

  return {
    user: { id: user.id, name: user.name, email: user.email },
    business: { id: membership.business.id, name: membership.business.name }
  }
})
