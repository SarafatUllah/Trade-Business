import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const query = getQuery(event)
  const entity = (query.entity as string) || 'TRANSACTION'

  return prisma.fieldDefinition.findMany({
    where: { businessId: session.businessId, entity: entity as any, isArchived: false },
    orderBy: { sortOrder: 'asc' }
  })
})
