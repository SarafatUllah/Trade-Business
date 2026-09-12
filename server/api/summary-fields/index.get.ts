import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  return prisma.summaryFieldDefinition.findMany({
    where: { businessId: session.businessId },
    orderBy: { sortOrder: 'asc' }
  })
})
