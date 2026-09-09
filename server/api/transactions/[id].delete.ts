import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { logAudit } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const session = requireRole(event, 'STAFF')
  const id = getRouterParam(event, 'id')!

  const existing = await prisma.transaction.findFirst({ where: { id, businessId: session.businessId } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })

  // Archive rather than hard-delete: preserves historical/auditable truth.
  const archived = await prisma.transaction.update({ where: { id }, data: { isArchived: true } })

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'Transaction', entityId: id, action: 'DELETE', before: existing, after: archived })

  return { success: true }
})
