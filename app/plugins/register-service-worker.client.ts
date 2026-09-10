export default defineNuxtPlugin(() => {
  if (!(import.meta.client && 'serviceWorker' in navigator)) return

  const registerNow = () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err)
    })
  }

  // Bug fix: this previously only registered inside a `window.onload`
  // listener. By the time a Nuxt app finishes hydrating (especially on a
  // slower mobile connection), the page's `load` event has very often
  // ALREADY fired — an addEventListener('load', ...) attached after the
  // fact never runs, since 'load' only fires once. That silently meant
  // the service worker was sometimes never registered at all, which then
  // made `navigator.serviceWorker.ready` (used by the push-enable flow)
  // hang forever waiting for a registration that would never arrive.
  if (document.readyState === 'complete') {
    registerNow()
  } else {
    window.addEventListener('load', registerNow, { once: true })
  }
})
