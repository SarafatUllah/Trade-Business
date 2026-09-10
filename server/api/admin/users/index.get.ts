import { requirePermission } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'canViewUsers')
  const query = getQuery(event)

  const where: any = {}
  if (query.status === 'ACTIVE' || query.status === 'DEACTIVATED') where.accountStatus = query.status
  if (query.trial === 'true') where.trialEndsAt = { not: null }
  if (query.search) {
    where.OR = [
      { name: { contains: query.search as string, mode: 'insensitive' } },
      { memberships: { some: { user: { OR: [
        { name: { contains: query.search as string, mode: 'insensitive' } },
        { email: { contains: query.search as string, mode: 'insensitive' } }
      ] } } } }
    ]
  }

  const businesses = await prisma.business.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      memberships: { where: { role: 'OWNER' }, take: 1, include: { user: { select: { id: true, name: true, email: true, createdAt: true } } } },
      signupCode: { select: { code: true, type: true } },
      _count: { select: { transactions: true, parties: true } }
    }
  })

  return businesses.map(b => ({
    id: b.id,
    name: b.name,
    accountStatus: b.accountStatus,
    trialEndsAt: b.trialEndsAt,
    createdAt: b.createdAt,
    owner: b.memberships[0]?.user ?? null,
    signupCode: b.signupCode,
    transactionCount: b._count.transactions,
    partyCount: b._count.parties
  }))
})
