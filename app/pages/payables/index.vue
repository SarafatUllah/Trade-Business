<template>
  <div>
    <div class="tabs">
      <select v-model="statusFilter">
        <option value="">All statuses</option>
        <option value="UNPAID">Unpaid</option>
        <option value="PARTIALLY_PAID">Partially paid</option>
        <option value="OVERDUE">Overdue</option>
        <option value="PAID">Paid</option>
      </select>
    </div>

    <div v-if="pending" class="empty-state">Loading…</div>
    <div v-else-if="!data?.length" class="empty-state">Nothing to pay. 🎉</div>

    <div class="card list-card">
      <NuxtLink v-for="p in data" :key="p.id" :to="`/payables/${p.id}`" class="ledger-row" :class="{ overdue: p.status === 'OVERDUE' }">
        <div class="row-main">
          <strong>{{ p.party.name }}</strong>
          <small>Due {{ formatDate(p.dueDate) }} · <span class="pill" :class="p.status === 'OVERDUE' ? 'overdue' : 'payable'">{{ p.status.replace('_', ' ') }}</span></small>
        </div>
        <span class="num payable-text">{{ format(p.remaining) }}</span>
      </NuxtLink>
    </div>

    <NuxtLink to="/payables/new" class="fab payable" aria-label="Add payable">+</NuxtLink>
  </div>
</template>

<script setup lang="ts">
const { format } = useCurrency()
const statusFilter = ref('')
const { data, pending } = await useFetch('/api/payables', { query: computed(() => ({ status: statusFilter.value || undefined })) })

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
.payable-text { color: var(--payable-600); font-weight: 700; }
.fab {
  position: fixed; right: 20px; bottom: calc(88px + env(safe-area-inset-bottom));
  width: 56px; height: 56px; border-radius: 50%; color: white;
  font-size: 28px; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(22,33,43,0.3); z-index: 15;
}
.fab.payable { background: var(--payable-600); }
</style>
