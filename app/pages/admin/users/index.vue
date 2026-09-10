<template>
  <div>
    <div class="filters">
      <input v-model="search" type="search" placeholder="Search name or email…" @input="debouncedReload" />
      <select v-model="statusFilter" @change="reload">
        <option value="">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="DEACTIVATED">Deactivated</option>
      </select>
    </div>

    <div v-if="pending"><SkeletonLoader :rows="5" :row-height="76" /></div>
    <div v-else-if="!data?.length"><EmptyState :icon="Users" message="No accounts found" /></div>

    <div v-else class="card full-bleed list-card">
      <div v-for="b in data" :key="b.id" class="user-row">
        <NuxtLink :to="`/admin/users/${b.id}`" class="row-link">
          <div class="activity-icon" :class="b.accountStatus === 'ACTIVE' ? 'teal' : 'amber'"><Building2 :size="16" :stroke-width="2.2" /></div>
          <div class="row-main">
            <strong>{{ b.name }}</strong>
            <small>{{ b.owner?.name }} · {{ b.owner?.email }}</small>
            <small class="meta">{{ b.transactionCount }} entries · {{ b.partyCount }} parties · joined {{ formatDate(b.createdAt) }}</small>
            <small v-if="b.trialEndsAt" class="trial-badge">Trial ends {{ formatDate(b.trialEndsAt) }}</small>
          </div>
        </NuxtLink>
        <div class="row-actions">
          <span class="pill" :class="b.accountStatus === 'ACTIVE' ? 'receivable' : 'overdue'">{{ b.accountStatus }}</span>
          <button v-if="can('canManageUserStatus')" class="btn secondary small" @click="toggleStatus(b)">
            {{ b.accountStatus === 'ACTIVE' ? 'Deactivate' : 'Activate' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Users, Building2 } from '@lucide/vue'
definePageMeta({ layout: 'admin' })

const adminStore = useAdminStore()
const can = adminStore.can

const search = ref('')
const statusFilter = ref('')

const { data, pending, refresh } = await useFetch('/api/admin/users', {
  query: computed(() => ({ search: search.value || undefined, status: statusFilter.value || undefined }))
})

function reload() { refresh() }
let debounceTimer: ReturnType<typeof setTimeout>
function debouncedReload() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(reload, 350)
}

async function toggleStatus(b: any) {
  const nextStatus = b.accountStatus === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE'
  if (!confirm(`${nextStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'} "${b.name}"?`)) return
  await $fetch(`/api/admin/users/${b.id}/status`, { method: 'PATCH', body: { status: nextStatus } })
  await refresh()
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.filters { display: flex; gap: 8px; margin-bottom: 14px; }
.filters input { flex: 1; min-height: 44px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: var(--radius-sm); font-size: 16px; background: white; }
.filters select { min-height: 44px; padding: 10px; border: 1.5px solid var(--line); border-radius: var(--radius-sm); background: white; font-size: 14px; }
.list-card { padding: 4px 14px; }
.user-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.user-row:last-child { border-bottom: none; }
.row-link { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.activity-icon { width: 36px; height: 36px; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.activity-icon.teal { background: var(--receivable-100); color: var(--receivable-600); }
.activity-icon.amber { background: var(--payable-100); color: var(--payable-600); }
.row-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.row-main small { color: var(--ink-400); font-size: 12px; }
.meta { font-size: 11px; }
.trial-badge { color: var(--payable-600); font-weight: 600; }
.row-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
.btn.small { padding: 6px 10px; min-height: auto; font-size: 12px; box-shadow: none; }
</style>
