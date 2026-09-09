import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const query = getQuery(event)
  const unreadOnly = query.unread === 'true'

  const notifications = await prisma.notification.findMany({
    where: {
      businessId: session.businessId,
      OR: [{ userId: session.userId }, { userId: null }],
      ...(unreadOnly ? { isRead: false } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  return notifications.map(n => ({
    id: n.id,
    channel: n.channel,
    title: n.title,
    body: n.body,
    data: n.data ? JSON.parse(n.data) : null,
    isRead: n.isRead,
    createdAt: n.createdAt
  }))
})
