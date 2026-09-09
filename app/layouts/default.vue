<template>
  <div class="app-shell">
    <header class="topbar">
      <h1>{{ pageTitle }}</h1>
      <NuxtLink to="/notifications" class="bell" aria-label="Notifications">
        <Bell :size="22" :stroke-width="2" />
        <span v-if="unread > 0" class="dot">{{ unread > 9 ? '9+' : unread }}</span>
      </NuxtLink>
    </header>

    <main class="content container">
      <slot />
    </main>

    <nav class="tabbar" aria-label="Primary">
      <NuxtLink v-for="tab in tabs" :key="tab.to" :to="tab.to" class="tab" :class="{ active: isActive(tab.to) }">
        <span class="tab-icon">
          <component :is="tab.icon" :size="22" :stroke-width="isActive(tab.to) ? 2.4 : 2" />
        </span>
        <small>{{ tab.label }}</small>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { LayoutDashboard, BookText, CalendarClock, Factory, Settings, Bell } from '@lucide/vue'

const route = useRoute()
const unread = ref(0)

const tabs = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Ledger', icon: BookText },
  { to: '/calendar', label: 'Due', icon: CalendarClock },
  { to: '/parties', label: 'Parties', icon: Factory },
  { to: '/settings', label: 'More', icon: Settings }
]

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}

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
  padding: calc(env(safe-area-inset-top) + 16px) 18px 16px;
  background: var(--ink-900);
  color: white;
}
.topbar h1 { font-size: 20px; color: white; }
.bell { position: relative; color: white; display: flex; padding: 4px; }
.dot {
  position: absolute;
  top: -4px;
  right: -6px;
  background: var(--overdue-600);
  color: white;
  font-size: 10px;
  font-weight: 700;
  border-radius: 999px;
  min-width: 17px;
  height: 17px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  border: 2px solid var(--ink-900);
}

.content {
  flex: 1;
  padding-top: 18px;
  padding-bottom: 100px;
}

.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: white;
  border-top: 1px solid var(--line);
  padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
  z-index: 20;
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 0 4px;
  color: var(--ink-400);
  border-radius: var(--radius-sm);
  transition: color 0.15s ease;
}
.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 30px;
  border-radius: 999px;
  transition: background 0.2s ease, color 0.2s ease;
}
.tab.active .tab-icon { background: var(--accent); color: white; }
.tab small { font-size: 11px; font-weight: 600; }
.tab.active { color: var(--ink-900); }
.tab:active .tab-icon { transform: scale(0.9); }

@media (min-width: 900px) {
  .tabbar { max-width: 720px; margin: 0 auto; left: 0; right: 0; border-left: 1px solid var(--line); border-right: 1px solid var(--line); border-radius: 20px 20px 0 0; bottom: 0; box-shadow: var(--shadow-float); }
}
</style>
