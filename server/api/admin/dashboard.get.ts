import { requireAdmin } from '../../utils/admin-auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const [totalBusinesses, activeBusinesses, deactivatedBusinesses, trialBusinesses, totalCodes, unusedCodes] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { accountStatus: 'ACTIVE' } }),
    prisma.business.count({ where: { accountStatus: 'DEACTIVATED' } }),
    prisma.business.count({ where: { trialEndsAt: { not: null }, accountStatus: 'ACTIVE' } }),
    prisma.signupCode.count(),
    prisma.signupCode.count({ where: { usedAt: null, isRevoked: false } })
  ])

  const recentBusinesses = await prisma.business.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: { memberships: { where: { role: 'OWNER' }, take: 1, include: { user: { select: { name: true, email: true } } } } }
  })

  return {
    totalBusinesses,
    activeBusinesses,
    deactivatedBusinesses,
    trialBusinesses,
    totalCodes,
    unusedCodes,
    recentBusinesses: recentBusinesses.map(b => ({
      id: b.id,
      name: b.name,
      accountStatus: b.accountStatus,
      trialEndsAt: b.trialEndsAt,
      createdAt: b.createdAt,
      owner: b.memberships[0]?.user ?? null
    }))
  }
})
