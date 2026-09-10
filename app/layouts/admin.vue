<template>
  <div class="admin-shell">
    <header class="admin-topbar">
      <div class="brand"><ShieldCheck :size="20" :stroke-width="2.2" /> <span>Admin Panel</span></div>
      <button class="signout" @click="onLogout"><LogOut :size="16" :stroke-width="2.2" /></button>
    </header>
    <nav class="admin-nav">
      <NuxtLink to="/admin" class="nav-item" :class="{ active: route.path === '/admin' }">Dashboard</NuxtLink>
      <NuxtLink to="/admin/users" class="nav-item" :class="{ active: route.path.startsWith('/admin/users') }">Users</NuxtLink>
      <NuxtLink to="/admin/codes" class="nav-item" :class="{ active: route.path.startsWith('/admin/codes') }">Codes</NuxtLink>
      <NuxtLink v-if="admin.isSuperAdmin" to="/admin/admins" class="nav-item" :class="{ active: route.path.startsWith('/admin/admins') }">Sub-Admins</NuxtLink>
      <NuxtLink to="/admin/account" class="nav-item" :class="{ active: route.path.startsWith('/admin/account') }">My Account</NuxtLink>
    </nav>
    <main class="admin-content container">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ShieldCheck, LogOut } from '@lucide/vue'
const route = useRoute()
const router = useRouter()
const admin = useAdminStore()

onMounted(async () => {
  if (!admin.loaded) {
    try { await admin.fetchSession() } catch { /* not authenticated */ }
  }
})

async function onLogout() {
  await admin.logout()
  router.push('/admin/login')
}
</script>

<style scoped>
.admin-shell { min-height: 100dvh; width: 100%; overflow-x: hidden; display: flex; flex-direction: column; background: var(--paper-0); }
.admin-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: calc(env(safe-area-inset-top) + 16px) 18px 16px;
  background: var(--ink-900); color: white;
}
.brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 17px; }
.signout { background: rgba(255,255,255,0.12); border: none; color: white; width: 36px; height: 36px; border-radius: 999px; display: flex; align-items: center; justify-content: center; }
.admin-nav { display: flex; gap: 4px; padding: 10px 12px; background: white; border-bottom: 1px solid var(--line); overflow-x: auto; }
.nav-item { padding: 8px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--ink-400); white-space: nowrap; }
.nav-item.active { background: var(--accent); color: white; }
.admin-content { flex: 1; padding: 18px 16px 40px; min-width: 0; }
</style>
