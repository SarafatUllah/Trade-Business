export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith('/admin')) return
  const publicAdminPages = ['/admin/login', '/admin/forgot-password', '/admin/reset-password']
  if (publicAdminPages.includes(to.path)) return

  const hasAdminSession = useCookie('tb_admin_has_session')
  if (!hasAdminSession.value) {
    return navigateTo('/admin/login')
  }
})
