import { getAuthSession } from '../utils/auth'
import { prisma } from '../utils/prisma'

// A JWT session stays cryptographically valid until it expires, so if an
// admin deactivates a business while a user is mid-session, the token
// alone wouldn't reflect that. This runs once per API request (excluding
// auth/admin/cron routes, which have their own handling) and rejects
// deactivated accounts immediately rather than waiting for their token
// to expire or for them to log in again.
export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/')) return
  if (path.startsWith('/api/auth/') || path.startsWith('/api/admin/') || path.startsWith('/api/cron/')) return

  const session = getAuthSession(event)
  if (!session) return // let the route's own requireSession handle unauthenticated access

  const business = await prisma.business.findUnique({ where: { id: session.businessId }, select: { accountStatus: true } })
  if (business?.accountStatus === 'DEACTIVATED') {
    throw createError({
      statusCode: 403,
      statusMessage: 'This account has been deactivated. Please contact your administrator.'
    })
  }
})
