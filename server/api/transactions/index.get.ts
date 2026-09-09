import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { getActiveFields, getComputedFieldValues } from '../../utils/fields'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const query = getQuery(event)

  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25))

  const where: any = { businessId: session.businessId, isArchived: false }
  if (query.partyId) where.partyId = query.partyId as string
  if (query.dateFrom || query.dateTo) {
    where.date = {}
    if (query.dateFrom) where.date.gte = new Date(query.dateFrom as string)
    if (query.dateTo) where.date.lte = new Date(query.dateTo as string)
  }
  if (query.search) where.description = { contains: query.search as string }

  const [total, transactions, fields] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { party: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    getActiveFields(session.businessId, 'TRANSACTION')
  ])

  const rows = await Promise.all(
    transactions.map(async (t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      party: t.party,
      fields: await getComputedFieldValues(fields, t.id)
    }))
  )

  return {
    fields: fields.map(f => ({ id: f.id, key: f.key, label: f.label, type: f.type, showInTable: f.showInTable, isFilterable: f.isFilterable })),
    rows,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
  }
})
