// Route guard: checks only for the *presence* of a non-sensitive
// "logged in" flag cookie — never makes an HTTP call back to our own
// server during middleware, and never tries to read the real session
// cookie (which is httpOnly and therefore invisible to client-side JS
// by design, so checking it directly here would incorrectly treat every
// logged-in client-side navigation as logged-out).
//
// The flag cookie carries no secret. Real authorization for every
// protected action still comes from the httpOnly session cookie and
// server-side JWT verification (see server/utils/auth.ts) — an invalid,
// expired, or missing session there is rejected with a 401 regardless of
// what this flag cookie says.
export default defineNuxtRouteMiddleware((to) => {
  const publicPages = ['/login', '/register', '/forgot-password', '/reset-password']
  if (publicPages.includes(to.path)) return

  const hasSession = useCookie('tb_has_session')
  if (!hasSession.value) {
    return navigateTo('/login')
  }
})
