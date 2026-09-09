import { z } from 'zod'
import { requireSession } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() })
})

export default defineEventHandler(async (event) => {
  const session = requireSession(event)
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid subscription payload' })

  await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: { userId: session.userId, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth },
    update: { userId: session.userId, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth }
  })

  return { success: true }
})
