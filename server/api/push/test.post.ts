import { requireSession } from '../../utils/auth'
import { dispatchNotification } from '../../services/notification-providers'

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  await dispatchNotification(
    {
      businessId: session.businessId,
      userId: session.userId,
      title: 'Test notification',
      body: 'Push notifications are working on this device 🎉',
      data: {}
    },
    ['IN_APP', 'PUSH']
  )
  return { success: true }
})
