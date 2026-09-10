import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { prisma } from '../../utils/prisma'
import { dispatchNotification } from '../../services/notification-providers'

const schema = z.object({ email: z.string().email() })

const RESET_TTL_SECONDS = 60 * 30 // 30 minutes

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })

  const config = useRuntimeConfig(event)
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { memberships: { take: 1, orderBy: { createdAt: 'asc' } } }
  })

  // Always return the same generic response whether or not the email
  // exists, so this endpoint can't be used to enumerate registered users.
  const genericResponse = { message: 'If that email is registered, a password reset link has been sent.' }
  if (!user) return genericResponse

  const resetToken = jwt.sign({ userId: user.id, purpose: 'password_reset' }, config.jwtSecret, { expiresIn: RESET_TTL_SECONDS })
  const origin = getRequestURL(event).origin
  const resetLink = `${origin}/reset-password?token=${resetToken}`

  const businessId = user.memberships[0]?.businessId
  if (businessId) {
    await dispatchNotification(
      {
        businessId,
        userId: user.id,
        title: 'Password reset requested',
        body: `Reset your Trade Business password: ${resetLink} (expires in 30 minutes)`,
        data: { resetLink }
      },
      ['IN_APP', 'EMAIL']
    )
  }

  return genericResponse
})
