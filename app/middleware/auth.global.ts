// Route guard: checks only for the *presence* of the session cookie —
// never makes an HTTP call back to our own server during middleware.
// (A prior version called $fetch('/api/auth/me') here on every SSR page
// load, including unauthenticated first visits; a self-referential fetch
// during SSR middleware is a known source of runaway request loops on
// some hosts. Full session validation still happens normally on every
// authenticated API call — an invalid/expired cookie is simply rejected
// there with a 401, which the client handles by redirecting to login.)
export default defineNuxtRouteMiddleware((to) => {
  const publicPages = ['/login', '/register']
  if (publicPages.includes(to.path)) return

  const sessionCookie = useCookie('tb_session')
  if (!sessionCookie.value) {
    return navigateTo('/login')
  }
})
