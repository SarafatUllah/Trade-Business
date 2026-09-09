<template>
  <div>
    <div class="card list-card">
      <NuxtLink to="/settings/fields" class="ledger-row">
        <div class="row-main"><strong>Ledger fields & formulas</strong><small>Add, edit and reorder your custom columns</small></div>
      </NuxtLink>
      <NuxtLink to="/invoices" class="ledger-row">
        <div class="row-main"><strong>Invoices</strong><small>View and generate party invoices</small></div>
      </NuxtLink>
      <NuxtLink to="/notifications" class="ledger-row">
        <div class="row-main"><strong>Notifications</strong><small>In-app alerts and push settings</small></div>
      </NuxtLink>
    </div>

    <div class="card list-card business-info">
      <div class="row-main"><strong>{{ auth.business?.name }}</strong><small>Signed in as {{ auth.user?.email }}</small></div>
    </div>

    <button class="btn secondary block" @click="onLogout">Sign out</button>
  </div>
</template>

<script setup lang="ts">
const auth = useAuthStore()
const router = useRouter()
async function onLogout() {
  await auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.list-card { padding: 4px 12px; margin-bottom: 16px; }
.row-main small { color: var(--ink-400); }
.business-info { padding: 16px; }
</style>
