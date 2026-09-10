// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // This project's pages/components/layouts/etc. live under app/ (the
  // Nuxt 4-style layout). Nuxt 3.21 does not auto-detect that as the app
  // root the way Nuxt 4 does, so it must be set explicitly — without this,
  // Nuxt silently falls back to its built-in welcome page because it never
  // finds a custom app.vue or any pages.
  srcDir: 'app/',
  // IMPORTANT: srcDir also shifts Nitro's default serverDir AND public
  // directory resolution in this Nuxt version — the serverDir issue was
  // fixed earlier, but the public/ directory issue went unnoticed until
  // now: every file in public/ (favicon, manifest, icons, robots.txt,
  // service-worker.js) was silently absent from every deployed build,
  // since Nuxt actually looks for it at app/public/ once srcDir is set,
  // not the project-root public/ folder. Any request for these files fell
  // through to the SPA fallback, which (correctly, for an actual page)
  // redirected to /login — this is why service worker registration
  // silently failed forever: the browser received an HTML login-redirect
  // page instead of JavaScript when trying to register '/service-worker.js'.
  // Fixed by moving the public/ folder to app/public/ (its real location
  // in this configuration) rather than fighting the resolution further.
  serverDir: 'server/',
  modules: ['@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'Trade Business',
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      meta: [
        { name: 'theme-color', content: '#0F5132' },
        { name: 'description', content: 'Mobile-first accounting, ledger and invoice management for Mill/Party trade businesses.' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/icons/icon-192.png' }
      ]
    }
  },
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me-in-production',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    public: {
      appName: process.env.NUXT_PUBLIC_APP_NAME || 'Trade Business',
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || ''
    }
  },
  nitro: {
    experimental: { wasm: false }
  },
  typescript: {
    strict: true
  }
})
