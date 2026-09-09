<template>
  <div>
    <div class="tabs">
      <select v-model="statusFilter">
        <option value="">All statuses</option>
        <option value="UNRECEIVED">Unreceived</option>
        <option value="PARTIALLY_RECEIVED">Partially received</option>
        <option value="OVERDUE">Overdue</option>
        <option value="RECEIVED">Received</option>
      </select>
    </div>

    <div v-if="pending"><SkeletonLoader :rows="4" :row-height="70" /></div>
    <div v-else-if="!data?.length" class="empty-state">Nothing pending to receive.</div>

    <div class="card list-card">
      <NuxtLink v-for="r in data" :key="r.id" :to="`/receivables/${r.id}`" class="ledger-row" :class="{ overdue: r.status === 'OVERDUE' }">
        <div class="row-main">
          <strong>{{ r.party.name }}</strong>
          <small>Expected {{ formatDate(r.expectedDate) }} · <span class="pill" :class="r.status === 'OVERDUE' ? 'overdue' : 'receivable'">{{ r.status.replace('_', ' ') }}</span></small>
        </div>
        <span class="num receivable-text">{{ format(r.remaining) }}</span>
      </NuxtLink>
    </div>

    <NuxtLink to="/receivables/new" class="fab receivable" aria-label="Add receivable">+</NuxtLink>
  </div>
</template>

<script setup lang="ts">
const { format } = useCurrency()
const statusFilter = ref('')
const { data, pending } = await useFetch('/api/receivables', { query: computed(() => ({ status: statusFilter.value || undefined })) })

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
</script>

<style scoped>
.tabs { margin-bottom: 12px; }
.tabs select { width: 100%; min-height: 44px; padding: 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: white; font-size: 15px; }
.list-card { padding: 4px 12px; }
.row-main { display: flex; flex-direction: column; gap: 4px; }
.row-main small { color: var(--ink-400); }
.receivable-text { color: var(--receivable-600); font-weight: 700; }
.fab {
  position: fixed; right: 20px; bottom: calc(88px + env(safe-area-inset-bottom));
  width: 56px; height: 56px; border-radius: 50%; color: white;
  font-size: 28px; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(22,33,43,0.3); z-index: 15;
}
.fab.receivable { background: var(--receivable-600); }
</style>
