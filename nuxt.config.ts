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
  // IMPORTANT: srcDir above also shifts Nitro's default serverDir
  // resolution in this Nuxt version, which silently dropped every
  // server/api/* route from the build (they compiled with zero warnings —
  // the routes just didn't exist, so every API call fell through to the
  // page renderer instead, which is why login/register appeared to "do
  // nothing"). Pin serverDir explicitly back to the project root so
  // server/ is found regardless of srcDir.
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
