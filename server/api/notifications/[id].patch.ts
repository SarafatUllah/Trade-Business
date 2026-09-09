import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const id = getRouterParam(event, 'id')!

  const notif = await prisma.notification.findFirst({ where: { id, businessId: session.businessId } })
  if (!notif) throw createError({ statusCode: 404, statusMessage: 'Notification not found' })

  await prisma.notification.update({ where: { id }, data: { isRead: true } })
  return { success: true }
})
