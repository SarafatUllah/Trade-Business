import { prisma } from './prisma'

export async function logAudit(opts: {
  businessId: string
  userId?: string | null
  entity: string
  entityId: string
  action: 'CREATE' | 'UPDATE' | 'REVERSE' | 'DELETE'
  before?: unknown
  after?: unknown
}) {
  await prisma.auditLog.create({
    data: {
      businessId: opts.businessId,
      userId: opts.userId ?? null,
      entity: opts.entity,
      entityId: opts.entityId,
      action: opts.action,
      before: opts.before !== undefined ? JSON.stringify(opts.before) : null,
      after: opts.after !== undefined ? JSON.stringify(opts.after) : null
    }
  })
}
