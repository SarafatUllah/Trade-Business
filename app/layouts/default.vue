<template>
  <div class="app-shell">
    <header class="topbar">
      <h1>{{ pageTitle }}</h1>
      <NuxtLink to="/notifications" class="bell" aria-label="Notifications">
        🔔
        <span v-if="unread > 0" class="dot">{{ unread }}</span>
      </NuxtLink>
    </header>

    <main class="content container">
      <slot />
    </main>

    <nav class="tabbar" aria-label="Primary">
      <NuxtLink to="/" class="tab" :class="{ active: route.path === '/' }">
        <span>🏠</span><small>Dashboard</small>
      </NuxtLink>
      <NuxtLink to="/transactions" class="tab" :class="{ active: route.path.startsWith('/transactions') }">
        <span>📒</span><small>Ledger</small>
      </NuxtLink>
      <NuxtLink to="/calendar" class="tab" :class="{ active: route.path.startsWith('/calendar') }">
        <span>📅</span><small>Due</small>
      </NuxtLink>
      <NuxtLink to="/parties" class="tab" :class="{ active: route.path.startsWith('/parties') }">
        <span>🏭</span><small>Parties</small>
      </NuxtLink>
      <NuxtLink to="/settings" class="tab" :class="{ active: route.path.startsWith('/settings') }">
        <span>⚙️</span><small>More</small>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const unread = ref(0)

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/transactions': 'Ledger',
  '/calendar': 'Due Calendar',
  '/parties': 'Mills / Parties',
  '/payables': 'Money I Must Pay',
  '/receivables': 'Money I Must Receive',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
  '/invoices': 'Invoices'
}
const pageTitle = computed(() => titles[route.path] ?? 'Trade Business')

async function refreshUnread() {
  try {
    const list = await $fetch('/api/notifications', { query: { unread: 'true' } })
    unread.value = list.length
  } catch { /* not authenticated yet */ }
}

onMounted(() => {
  refreshUnread()
  // Poll rather than relying on a persistent connection — keeps this
  // resilient on flaky mobile networks.
  const interval = setInterval(refreshUnread, 60_000)
  onUnmounted(() => clearInterval(interval))
})
</script>

<style scoped>
.app-shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top) + 14px) 16px 14px;
  background: var(--ink-900);
  color: white;
}
.topbar h1 { font-size: 19px; color: white; }
.bell { position: relative; font-size: 20px; color: white; }
.dot {
  position: absolute;
  top: -6px;
  right: -8px;
  background: var(--overdue-600);
  color: white;
  font-size: 10px;
  font-weight: 700;
  border-radius: 999px;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
}

.content {
  flex: 1;
  padding-top: 16px;
  padding-bottom: 96px;
}

.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: white;
  border-top: 1px solid var(--line);
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 20;
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 0 6px;
  color: var(--ink-400);
  font-size: 20px;
}
.tab small { font-size: 11px; font-weight: 600; }
.tab.active { color: var(--ink-900); }
.tab.active::before {
  content: '';
  position: absolute;
}

@media (min-width: 900px) {
  .tabbar { max-width: 720px; margin: 0 auto; left: 0; right: 0; border-left: 1px solid var(--line); border-right: 1px solid var(--line); border-radius: 12px 12px 0 0; bottom: 0; }
}
</style>
