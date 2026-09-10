import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { prisma } from '../../../utils/prisma'

const schema = z.object({ email: z.string().email() })
const RESET_TTL_SECONDS = 60 * 30 // 30 minutes

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })

  const config = useRuntimeConfig(event)
  const admin = await prisma.platformAdmin.findUnique({ where: { email: parsed.data.email } })

  // Always the same generic response regardless of whether the email
  // exists, so this can't be used to enumerate admin accounts.
  const genericResponse = { message: 'If that email belongs to an admin account, a password reset link has been generated.' }
  if (!admin || !admin.isActive) return genericResponse

  // Same secret-derivation suffix as the admin session itself (see
  // server/utils/admin-auth.ts) — kept separate from the business-user
  // password reset token secret.
  const resetToken = jwt.sign(
    { adminId: admin.id, purpose: 'admin_password_reset' },
    `${config.jwtSecret}::admin`,
    { expiresIn: RESET_TTL_SECONDS }
  )
  const origin = getRequestURL(event).origin
  const resetLink = `${origin}/admin/reset-password?token=${resetToken}`

  // No email provider is configured for admin resets specifically (same
  // limitation noted for business users — see README). Logged server-side
  // so whoever has server log access (i.e. you, the developer/operator)
  // can retrieve it until real email delivery is wired up.
  console.warn(`[admin password reset] ${admin.email}: ${resetLink}`)

  return genericResponse
})
