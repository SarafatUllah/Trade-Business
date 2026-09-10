import { clearAdminSessionCookie } from '../../../utils/admin-auth'

export default defineEventHandler(async (event) => {
  clearAdminSessionCookie(event)
  return { success: true }
})
