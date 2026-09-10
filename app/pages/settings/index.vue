<template>
  <div>
    <div class="card full-bleed list-card">
      <NuxtLink v-for="item in menuItems" :key="item.to" :to="item.to" class="menu-row">
        <div class="menu-icon" :class="item.tint"><component :is="item.icon" :size="18" :stroke-width="2.2" /></div>
        <div class="row-main">
          <strong>{{ item.label }}</strong>
          <small>{{ item.description }}</small>
        </div>
        <ChevronRight :size="18" :stroke-width="2.2" class="chevron" />
      </NuxtLink>
    </div>

    <div class="card full-bleed profile-card">
      <div class="avatar"><Building2 :size="20" :stroke-width="2.2" /></div>
      <div class="row-main">
        <strong>{{ auth.business?.name }}</strong>
        <small>Signed in as {{ auth.user?.email }}</small>
      </div>
    </div>

    <button class="btn secondary block signout-btn" @click="onLogout">
      <LogOut :size="17" :stroke-width="2.2" /> Sign out
    </button>
  </div>
</template>

<script setup lang="ts">
import { Settings2, FileText, Bell, Building2, LogOut, ChevronRight } from '@lucide/vue'

const menuItems = [
  { to: '/settings/fields', label: 'Ledger fields & formulas', description: 'Add, edit and reorder your custom columns', icon: Settings2, tint: 'blue' },
  { to: '/invoices', label: 'Invoices', description: 'View and generate party invoices', icon: FileText, tint: 'teal' },
  { to: '/notifications', label: 'Notifications', description: 'In-app alerts and push settings', icon: Bell, tint: 'amber' }
]

const auth = useAuthStore()
const router = useRouter()
async function onLogout() {
  await auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.list-card { padding: 4px 14px; margin-bottom: 16px; }
.menu-row { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--line); }
.menu-row:last-child { border-bottom: none; }
.menu-icon {
  width: 38px; height: 38px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.menu-icon.blue { background: rgba(67, 97, 238, 0.12); color: var(--accent); }
.menu-icon.teal { background: var(--receivable-100); color: var(--receivable-600); }
.menu-icon.amber { background: var(--payable-100); color: var(--payable-600); }
.row-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.row-main strong { font-size: 14px; }
.row-main small { color: var(--ink-400); font-size: 12px; }
.chevron { color: var(--ink-400); flex-shrink: 0; }

.profile-card { display: flex; align-items: center; gap: 12px; padding: 16px; margin-bottom: 16px; }
.avatar {
  width: 44px; height: 44px; border-radius: 999px;
  background: var(--ink-900); color: white;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.signout-btn { display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--overdue-600); }
</style>
