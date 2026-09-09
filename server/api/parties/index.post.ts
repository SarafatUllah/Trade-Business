import { z } from 'zod'
import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { logAudit } from '../../utils/audit'

const schema = z.object({
  name: z.string().min(1).max(150),
  phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  notes: z.string().max(2000).optional()
})

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })

  const party = await prisma.party.create({
    data: { businessId: session.businessId, ...parsed.data }
  })

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'Party', entityId: party.id, action: 'CREATE', after: party })

  return party
})
