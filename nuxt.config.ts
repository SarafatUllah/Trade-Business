// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  css: ['./app/assets/css/main.css'],
  app: {
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
