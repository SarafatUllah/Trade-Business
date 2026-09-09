<template>
  <div>
    <div class="filters">
      <input v-model="search" type="search" placeholder="Search description…" @input="debouncedReload" />
      <button class="btn secondary" @click="showFilters = !showFilters">Filters</button>
    </div>

    <div v-if="showFilters" class="card filter-panel">
      <div class="field">
        <label>Party</label>
        <select v-model="partyId" @change="reload">
          <option value="">All parties</option>
          <option v-for="p in parties" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div class="field">
        <label>From</label>
        <input v-model="dateFrom" type="date" @change="reload" />
      </div>
      <div class="field">
        <label>To</label>
        <input v-model="dateTo" type="date" @change="reload" />
      </div>
    </div>

    <div v-if="pending" class="empty-state">Loading…</div>
    <div v-else-if="!data?.rows?.length" class="empty-state">
      No transactions yet. Tap + to add your first ledger entry.
    </div>

    <!-- Mobile: card/list view -->
    <div class="mobile-list">
      <NuxtLink v-for="row in data?.rows" :key="row.id" :to="`/transactions/${row.id}`" class="ledger-row">
        <div class="row-main">
          <strong>{{ row.party?.name ?? 'General entry' }}</strong>
          <small>{{ formatDate(row.date) }} · {{ row.description || 'No description' }}</small>
          <small class="field-chips">
            <span v-for="f in visibleFields" :key="f.key">{{ f.label }}: {{ display(row.fields[f.key]) }}</span>
          </small>
        </div>
      </NuxtLink>
    </div>

    <!-- Desktop: table view -->
    <div class="desktop-table card">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Party</th>
            <th v-for="f in visibleFields" :key="f.key">{{ f.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data?.rows" :key="row.id" @click="navigateTo(`/transactions/${row.id}`)">
            <td>{{ formatDate(row.date) }}</td>
            <td>{{ row.party?.name ?? '—' }}</td>
            <td v-for="f in visibleFields" :key="f.key">{{ display(row.fields[f.key]) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="data?.pagination && data.pagination.totalPages > 1" class="pager">
      <button class="btn secondary" :disabled="page <= 1" @click="page--; reload()">Prev</button>
      <span>{{ page }} / {{ data.pagination.totalPages }}</span>
      <button class="btn secondary" :disabled="page >= data.pagination.totalPages" @click="page++; reload()">Next</button>
    </div>

    <NuxtLink to="/transactions/new" class="fab" aria-label="Add transaction">+</NuxtLink>
  </div>
</template>

<script setup lang="ts">
const search = ref('')
const partyId = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)
const showFilters = ref(false)

const { data: parties } = await useFetch('/api/parties')

const { data, pending, refresh } = await useFetch('/api/transactions', {
  query: computed(() => ({
    search: search.value || undefined,
    partyId: partyId.value || undefined,
    dateFrom: dateFrom.value || undefined,
    dateTo: dateTo.value || undefined,
    page: page.value
  }))
})

const visibleFields = computed(() => (data.value?.fields ?? []).filter((f: any) => f.showInTable))

function reload() { page.value = 1; refresh() }
let debounceTimer: ReturnType<typeof setTimeout>
function debouncedReload() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(reload, 350)
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function display(v: unknown) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return String(v)
}
</script>

<style scoped>
.filters { display: flex; gap: 8px; margin-bottom: 12px; }
.filters input { flex: 1; min-height: 44px; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius-sm); font-size: 16px; background: white; }
.filter-panel { margin-bottom: 12px; }
.mobile-list { display: block; }
.field-chips { display: flex; gap: 10px; flex-wrap: wrap; }
.desktop-table { display: none; }
.pager { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 16px; }

.fab {
  position: fixed;
  right: 20px;
  bottom: calc(88px + env(safe-area-inset-bottom));
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--ink-900);
  color: white;
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(22,33,43,0.3);
  z-index: 15;
}

@media (min-width: 900px) {
  .mobile-list { display: none; }
  .desktop-table { display: block; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); font-size: 14px; }
  tbody tr:hover { background: var(--paper-100); cursor: pointer; }
}
</style>
