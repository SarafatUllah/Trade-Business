import { z } from 'zod'
import { requireAdmin } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

const schema = z.object({
  name: z.string().min(1).max(150).optional(),
  email: z.string().email().optional()
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })

  if (parsed.data.email && parsed.data.email !== admin.email) {
    const existing = await prisma.platformAdmin.findUnique({ where: { email: parsed.data.email } })
    if (existing) throw createError({ statusCode: 409, statusMessage: 'An admin with this email already exists' })
  }

  const updated = await prisma.platformAdmin.update({
    where: { id: admin.id },
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true }
  })

  return updated
})
