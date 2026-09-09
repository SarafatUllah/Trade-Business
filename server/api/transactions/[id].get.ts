import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { getActiveFields, getComputedFieldValues } from '../../utils/fields'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const id = getRouterParam(event, 'id')!

  const transaction = await prisma.transaction.findFirst({
    where: { id, businessId: session.businessId },
    include: { party: { select: { id: true, name: true } } }
  })
  if (!transaction) throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })

  const fields = await getActiveFields(session.businessId, 'TRANSACTION')
  const computed = await getComputedFieldValues(fields, transaction.id)

  return { ...transaction, fields: computed, fieldDefs: fields }
})
