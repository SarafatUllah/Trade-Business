import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { hashPassword, signSession, setSessionCookie } from '../../utils/auth'

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  businessName: z.string().min(2).max(150),
  signupCode: z.string().min(1, 'A signup code is required')
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  }
  const { name, email, password, businessName, signupCode } = parsed.data

  // There is no open public registration — every account is created by
  // redeeming a code an admin generated after collecting payment (or as a
  // free trial). This is the sole gate on account creation.
  const code = await prisma.signupCode.findUnique({ where: { code: signupCode.trim().toUpperCase() } })
  if (!code) throw createError({ statusCode: 400, statusMessage: 'Invalid signup code' })
  if (code.isRevoked) throw createError({ statusCode: 400, statusMessage: 'This signup code has been revoked' })
  if (code.usedAt) throw createError({ statusCode: 400, statusMessage: 'This signup code has already been used' })
  if (code.expiresAt && code.expiresAt < new Date()) throw createError({ statusCode: 400, statusMessage: 'This signup code has expired' })

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' })
  }

  const passwordHash = await hashPassword(password)
  const trialEndsAt = code.type === 'FREE_TRIAL' && code.trialDays
    ? new Date(Date.now() + code.trialDays * 86400000)
    : null

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name, email, passwordHash } })
    const business = await tx.business.create({
      data: { name: businessName, signupCodeId: code.id, trialEndsAt, accountStatus: 'ACTIVE' }
    })
    await tx.membership.create({ data: { userId: user.id, businessId: business.id, role: 'OWNER' } })
    await tx.signupCode.update({ where: { id: code.id }, data: { usedAt: new Date() } })
    return { user, business }
  })

  const token = signSession(event, { userId: result.user.id, businessId: result.business.id, role: 'OWNER' })
  setSessionCookie(event, token)

  return {
    user: { id: result.user.id, name: result.user.name, email: result.user.email },
    business: { id: result.business.id, name: result.business.name }
  }
})
