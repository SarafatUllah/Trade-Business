export default defineNuxtRouteMiddleware(async (to) => {
  const publicPages = ['/login', '/register']
  if (publicPages.includes(to.path)) return

  const auth = useAuthStore()
  if (!auth.loaded) {
    try { await auth.fetchSession() } catch { /* not authenticated */ }
  }
  if (!auth.isAuthenticated) {
    return navigateTo('/login')
  }
})
