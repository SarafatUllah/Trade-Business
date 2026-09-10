<template>
  <div v-if="data">
    <div class="card full-bleed header-card">
      <h2>{{ data.name }}</h2>
      <span class="pill" :class="data.accountStatus === 'ACTIVE' ? 'receivable' : 'overdue'">{{ data.accountStatus }}</span>
      <p v-if="data.trialEndsAt" class="trial-note">Free trial ends {{ formatDate(data.trialEndsAt) }}</p>
      <p class="joined">Joined {{ formatDate(data.createdAt) }} · Currency {{ data.currency }}</p>
    </div>

    <div v-if="can('canManageUserStatus') || can('canDeleteUsers')" class="actions">
      <button v-if="can('canManageUserStatus')" class="btn" :class="data.accountStatus === 'ACTIVE' ? 'secondary' : ''" @click="toggleStatus">
        {{ data.accountStatus === 'ACTIVE' ? 'Deactivate account' : 'Activate account' }}
      </button>
      <button v-if="can('canDeleteUsers')" class="btn danger" @click="onDelete">Delete account</button>
    </div>

    <h3 class="section-title">Members</h3>
    <div class="card full-bleed list-card">
      <div v-for="m in data.members" :key="m.user.id" class="row">
        <div class="row-main">
          <strong>{{ m.user.name }}</strong>
          <small>{{ m.user.email }}</small>
        </div>
        <span class="pill neutral">{{ m.role }}</span>
      </div>
    </div>
    <p class="privacy-note"><Lock :size="12" :stroke-width="2.2" /> Passwords and login sessions are never visible here — admin access is limited to account status and profile info.</p>

    <h3 class="section-title">Activity</h3>
    <div class="card full-bleed list-card">
      <div class="row"><span class="label">Ledger entries</span><span class="value num">{{ data.stats.transactions }}</span></div>
      <div class="row"><span class="label">Parties</span><span class="value num">{{ data.stats.parties }}</span></div>
      <div class="row"><span class="label">Payables</span><span class="value num">{{ data.stats.payables }}</span></div>
      <div class="row"><span class="label">Receivables</span><span class="value num">{{ data.stats.receivables }}</span></div>
      <div class="row"><span class="label">Invoices</span><span class="value num">{{ data.stats.invoices }}</span></div>
    </div>

    <template v-if="data.signupCode">
      <h3 class="section-title">Signup code used</h3>
      <div class="card full-bleed list-card">
        <div class="row"><span class="label">Code</span><span class="value num">{{ data.signupCode.code }}</span></div>
        <div class="row"><span class="label">Type</span><span class="value">{{ data.signupCode.type }}</span></div>
        <div v-if="data.signupCode.notes" class="row"><span class="label">Notes</span><span class="value">{{ data.signupCode.notes }}</span></div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Lock } from '@lucide/vue'
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const can = adminStore.can

const { data, refresh } = await useFetch(`/api/admin/users/${route.params.id}`)

async function toggleStatus() {
  if (!data.value) return
  const nextStatus = data.value.accountStatus === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE'
  if (!confirm(`${nextStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'} "${data.value.name}"?`)) return
  await $fetch(`/api/admin/users/${route.params.id}/status`, { method: 'PATCH', body: { status: nextStatus } })
  await refresh()
}

async function onDelete() {
  if (!data.value) return
  if (!confirm(`Permanently delete "${data.value.name}" and all its data? This cannot be undone.`)) return
  await $fetch(`/api/admin/users/${route.params.id}`, { method: 'DELETE' })
  router.push('/admin/users')
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.header-card { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.header-card h2 { font-size: 20px; }
.trial-note { color: var(--payable-600); font-weight: 600; font-size: 13px; margin: 0; }
.joined { color: var(--ink-400); font-size: 13px; margin: 0; }
.actions { display: flex; gap: 10px; margin-bottom: 20px; }
.actions .btn { flex: 1; }
.btn.danger { background: var(--overdue-600); }
.section-title { font-size: 15px; margin: 0 0 8px; color: var(--ink-700); }
.list-card { padding: 4px 14px; margin-bottom: 8px; }
.row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--line); }
.row:last-child { border-bottom: none; }
.row-main { display: flex; flex-direction: column; gap: 2px; }
.row-main small { color: var(--ink-400); }
.label { color: var(--ink-400); font-size: 14px; }
.privacy-note { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-400); margin: 0 0 20px; }
</style>
