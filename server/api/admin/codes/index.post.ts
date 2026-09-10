import { z } from 'zod'
import { nanoid } from 'nanoid'
import { requirePermission } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

const schema = z.object({
  type: z.enum(['PAID', 'FREE_TRIAL']),
  trialDays: z.number().int().positive().max(365).optional(),
  notes: z.string().max(500).optional(),
  expiresInDays: z.number().int().positive().max(365).optional() // optional expiry if never redeemed
})

function generateCode(): string {
  // Human-shareable: e.g. TRADE-7K2P9X — easy to read aloud/type over
  // phone/WhatsApp when handing it to a customer after payment.
  const suffix = nanoid(8).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  return `TRADE-${suffix}`
}

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'canGenerateCodes')
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  const data = parsed.data

  if (data.type === 'FREE_TRIAL' && !data.trialDays) {
    throw createError({ statusCode: 400, statusMessage: 'Free trial codes require a number of trial days' })
  }

  let code = generateCode()
  // Extremely unlikely collision given nanoid's alphabet, but guard anyway.
  for (let attempts = 0; attempts < 5; attempts++) {
    const existing = await prisma.signupCode.findUnique({ where: { code } })
    if (!existing) break
    code = generateCode()
  }

  const created = await prisma.signupCode.create({
    data: {
      code,
      type: data.type,
      trialDays: data.type === 'FREE_TRIAL' ? data.trialDays : null,
      notes: data.notes,
      createdByAdminId: admin.id,
      expiresAt: data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 86400000) : null
    }
  })

  await prisma.platformAuditLog.create({
    data: { adminId: admin.id, action: 'CREATE_CODE', targetType: 'SignupCode', targetId: created.id, details: JSON.stringify({ type: data.type, trialDays: data.trialDays }) }
  })

  return created
})
