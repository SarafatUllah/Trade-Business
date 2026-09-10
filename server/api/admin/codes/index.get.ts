import { requirePermission } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'canGenerateCodes')
  const query = getQuery(event)

  const where: any = {}
  if (query.status === 'used') where.usedAt = { not: null }
  if (query.status === 'unused') { where.usedAt = null; where.isRevoked = false }
  if (query.status === 'revoked') where.isRevoked = true
  if (query.type === 'PAID' || query.type === 'FREE_TRIAL') where.type = query.type

  const codes = await prisma.signupCode.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      createdByAdmin: { select: { name: true } },
      business: { select: { id: true, name: true } }
    }
  })

  return codes.map(c => ({
    id: c.id,
    code: c.code,
    type: c.type,
    trialDays: c.trialDays,
    notes: c.notes,
    isRevoked: c.isRevoked,
    usedAt: c.usedAt,
    expiresAt: c.expiresAt,
    createdAt: c.createdAt,
    createdByAdmin: c.createdByAdmin.name,
    business: c.business
  }))
})
