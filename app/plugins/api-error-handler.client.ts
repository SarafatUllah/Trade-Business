// Overrides the global $fetch instance on the client (the documented
// Nuxt 3 pattern — see nuxt.com/docs/guide/recipes/custom-fetch) so that
// any unauthenticated API response, from any page, redirects cleanly to
// /login instead of surfacing as a raw "401 Not authenticated" crash
// page. Client-only deliberately: globalThis is shared across concurrent
// requests on the Node server, so overriding it there risks one request's
// error handler firing in a different, unrelated request's context.
// Server-side initial data loads guard against this individually instead
// (see the try/catch in pages that fetch during SSR).
export default defineNuxtPlugin((nuxtApp) => {
  const customFetch = $fetch.create({
    onResponseError(context) {
      if (context.response?.status === 401) {
        // The real session cookie is httpOnly and can't be touched here,
        // but the client-readable "logged in" flag cookie can and should
        // be cleared so the route middleware doesn't think we're still
        // authenticated on the next navigation.
        document.cookie = 'tb_has_session=; Max-Age=0; path=/;'
        nuxtApp.runWithContext(() => navigateTo('/login'))
      }
    }
  })
  globalThis.$fetch = customFetch as typeof globalThis.$fetch
})
