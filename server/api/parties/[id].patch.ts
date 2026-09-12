import { z } from 'zod'
import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { logAudit } from '../../utils/audit'

const schema = z.object({
  type: z.enum(['SELLER', 'BUYER']).optional(),
  name: z.string().min(1).max(150).optional(),
  phone: z.string().min(1).max(30).optional(),
  address: z.string().max(300).nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
})

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })

  const existing = await prisma.party.findFirst({ where: { id, businessId: session.businessId } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Party not found' })

  // Changing a party's type doesn't retroactively touch its existing
  // Payable/Receivable records — those keep whatever was already
  // created. It only changes which kind can be created for them going
  // forward, and which Summary total shows on their detail page.
  const updated = await prisma.party.update({ where: { id }, data: parsed.data })

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'Party', entityId: id, action: 'UPDATE', before: existing, after: updated })

  return updated
})
