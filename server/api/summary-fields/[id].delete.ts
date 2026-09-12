import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = requireRole(event, 'STAFF')
  const id = getRouterParam(event, 'id')!

  const existing = await prisma.summaryFieldDefinition.findFirst({ where: { id, businessId: session.businessId } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Summary field not found' })

  // Safe to hard-delete (not archive) — this is purely a display
  // configuration with no historical data of its own attached to it,
  // unlike a FieldDefinition whose values would be orphaned.
  await prisma.summaryFieldDefinition.delete({ where: { id } })
  return { success: true }
})
