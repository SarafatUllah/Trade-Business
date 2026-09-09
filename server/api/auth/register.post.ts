import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { hashPassword, signSession, setSessionCookie } from '../../utils/auth'

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  businessName: z.string().min(2).max(150)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() })
  }
  const { name, email, password, businessName } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' })
  }

  const passwordHash = await hashPassword(password)

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name, email, passwordHash } })
    const business = await tx.business.create({ data: { name: businessName } })
    await tx.membership.create({ data: { userId: user.id, businessId: business.id, role: 'OWNER' } })
    return { user, business }
  })

  const token = signSession(event, { userId: result.user.id, businessId: result.business.id, role: 'OWNER' })
  setSessionCookie(event, token)

  return {
    user: { id: result.user.id, name: result.user.name, email: result.user.email },
    business: { id: result.business.id, name: result.business.name }
  }
})
