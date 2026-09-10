import { requirePermission } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'canViewUsers')
  const id = getRouterParam(event, 'id')!

  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      memberships: { include: { user: { select: { id: true, name: true, email: true, createdAt: true } } } },
      signupCode: { select: { code: true, type: true, trialDays: true, notes: true, createdAt: true } },
      _count: { select: { transactions: true, parties: true, payables: true, receivables: true, invoices: true } }
    }
  })
  if (!business) throw createError({ statusCode: 404, statusMessage: 'Account not found' })

  return {
    id: business.id,
    name: business.name,
    currency: business.currency,
    accountStatus: business.accountStatus,
    trialEndsAt: business.trialEndsAt,
    createdAt: business.createdAt,
    signupCode: business.signupCode,
    // Deliberately profile info only — never passwordHash, never a way to
    // derive/forge a session for this business's users.
    members: business.memberships.map(m => ({
      role: m.role,
      user: m.user
    })),
    stats: business._count
  }
})
