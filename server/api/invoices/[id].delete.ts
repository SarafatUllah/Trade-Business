import { requireRole } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { logAudit } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const session = requireRole(event, 'STAFF')
  const id = getRouterParam(event, 'id')!

  const existing = await prisma.invoice.findFirst({ where: { id, businessId: session.businessId } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Invoice not found' })

  // Deleting an invoice only removes the generated document and its
  // frozen snapshot rows (InvoiceItem cascades) — it never touches the
  // underlying ledger transactions or Payable/Receivable records it was
  // built from, since those exist independently of any invoice.
  await prisma.invoice.delete({ where: { id } })

  await logAudit({ businessId: session.businessId, userId: session.userId, entity: 'Invoice', entityId: id, action: 'DELETE', before: existing })

  return { success: true }
})
