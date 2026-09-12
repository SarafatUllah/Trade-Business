import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = requireRole(event, 'STAFF')
  const id = getRouterParam(event, 'id')!

  const existing = await prisma.summaryFieldDefinition.findFirst({ where: { id, businessId: session.businessId } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Summary field not found' })

  // A STATUS line depends on two SUM lines by id — deleting one out from
  // under it would silently break that comparison.
  const dependents = await prisma.summaryFieldDefinition.findMany({
    where: {
      businessId: session.businessId,
      kind: 'STATUS',
      OR: [{ statusTotalSummaryId: id }, { statusPaidSummaryId: id }]
    }
  })
  if (dependents.length) {
    throw createError({
      statusCode: 409,
      statusMessage: `Cannot delete "${existing.label}" — used by: ${dependents.map(d => d.label).join(', ')}`
    })
  }

  // Safe to hard-delete (not archive) — this is purely a display
  // configuration with no historical data of its own attached to it,
  // unlike a FieldDefinition whose values would be orphaned.
  await prisma.summaryFieldDefinition.delete({ where: { id } })
  return { success: true }
})
