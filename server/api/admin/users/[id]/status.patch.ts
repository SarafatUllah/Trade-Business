import { z } from 'zod'
import { requirePermission } from '../../../../utils/admin-auth'
import { prisma } from '../../../../utils/prisma'

const schema = z.object({ status: z.enum(['ACTIVE', 'DEACTIVATED']) })

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'canManageUserStatus')
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })

  const business = await prisma.business.findUnique({ where: { id } })
  if (!business) throw createError({ statusCode: 404, statusMessage: 'Account not found' })

  const updated = await prisma.business.update({
    where: { id },
    data: {
      accountStatus: parsed.data.status,
      // Reactivating manually (e.g. after payment) clears any stale trial
      // deadline so the account doesn't get auto-deactivated again by the
      // trial-expiry check.
      ...(parsed.data.status === 'ACTIVE' ? { trialEndsAt: null } : {})
    }
  })

  await prisma.platformAuditLog.create({
    data: {
      adminId: admin.id,
      action: parsed.data.status === 'ACTIVE' ? 'ACTIVATE_BUSINESS' : 'DEACTIVATE_BUSINESS',
      targetType: 'Business',
      targetId: id,
      details: JSON.stringify({ businessName: business.name })
    }
  })

  return { id: updated.id, accountStatus: updated.accountStatus }
})
