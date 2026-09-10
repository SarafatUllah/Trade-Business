<template>
  <Transition name="overlay-fade">
    <div v-if="visible" class="page-loading-overlay" aria-hidden="true">
      <div class="spinner-ring" />
    </div>
  </Transition>
</template>

<script setup lang="ts">
const visible = ref(false)
let showTimer: ReturnType<typeof setTimeout> | undefined

// Registered in onMounted (client-only lifecycle), never at top-level
// setup — top-level code in a component also runs during SSR, where
// nuxtApp.hook() would attach a NEW listener on every single server
// request without ever being cleaned up. Over enough requests on a warm
// serverless instance that leak compounds and can destabilize the shared
// Nuxt app instance (observed as "[nuxt] instance unavailable" crashes).
// onUnmounted removes the listeners again so nothing accumulates even
// across client-side navigations.
onMounted(() => {
  const nuxtApp = useNuxtApp()

  const unhookStart = nuxtApp.hook('page:start', () => {
    // Debounced: most navigations resolve in well under 150ms (client-side
    // routing, already-cached data), so only show the overlay for the ones
    // that actually take long enough for a spinner to be worth showing —
    // avoids an annoying flash on every single tap.
    showTimer = setTimeout(() => { visible.value = true }, 150)
  })
  const unhookFinish = nuxtApp.hook('page:finish', () => {
    clearTimeout(showTimer)
    visible.value = false
  })

  onUnmounted(() => {
    unhookStart()
    unhookFinish()
    clearTimeout(showTimer)
  })
})
</script>

<style scoped>
.page-loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(20, 24, 31, 0.12);
  backdrop-filter: blur(1.5px);
}
.spinner-ring {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.5);
  border-top-color: var(--accent);
  background: white;
  box-shadow: var(--shadow-float);
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.overlay-fade-enter-active, .overlay-fade-leave-active { transition: opacity 0.15s ease; }
.overlay-fade-enter-from, .overlay-fade-leave-to { opacity: 0; }
</style>
