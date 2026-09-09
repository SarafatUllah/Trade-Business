import { getAuthSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = getAuthSession(event)
  if (!session) return { user: null, business: null }

  const [user, business] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, email: true } }),
    prisma.business.findUnique({ where: { id: session.businessId }, select: { id: true, name: true, currency: true, timezone: true } })
  ])

  return { user, business, role: session.role }
})
