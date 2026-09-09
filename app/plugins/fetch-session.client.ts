// Runs only in the browser. Session *validity* is enforced by the
// middleware (cookie presence) and by every API route (JWT verification);
// this plugin's only job is populating user/business display data (name,
// email, currency) for the UI after the page has mounted.
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  if (!auth.loaded) {
    try {
      await auth.fetchSession()
    } catch {
      // Not authenticated or session expired — pages that need auth will
      // already have been redirected to /login by the route middleware.
    }
  }
})
