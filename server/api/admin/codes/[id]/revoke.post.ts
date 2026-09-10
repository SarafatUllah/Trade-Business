import { requirePermission } from '../../../../utils/admin-auth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'canGenerateCodes')
  const id = getRouterParam(event, 'id')!

  const code = await prisma.signupCode.findUnique({ where: { id } })
  if (!code) throw createError({ statusCode: 404, statusMessage: 'Code not found' })
  if (code.usedAt) throw createError({ statusCode: 409, statusMessage: 'This code has already been used and cannot be revoked' })

  await prisma.signupCode.update({ where: { id }, data: { isRevoked: true } })
  await prisma.platformAuditLog.create({
    data: { adminId: admin.id, action: 'REVOKE_CODE', targetType: 'SignupCode', targetId: id }
  })

  return { success: true }
})
