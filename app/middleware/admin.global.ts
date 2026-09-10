export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith('/admin')) return
  if (to.path === '/admin/login') return

  const hasAdminSession = useCookie('tb_admin_has_session')
  if (!hasAdminSession.value) {
    return navigateTo('/admin/login')
  }
})
