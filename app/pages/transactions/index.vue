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

    <div v-if="pending"><SkeletonLoader :rows="5" :row-height="76" /></div>
    <div v-else-if="!data?.rows?.length">
      <EmptyState :icon="BookOpen" message="No ledger entries yet" hint="Tap the + button to add your first transaction." />
    </div>

    <!-- Mobile: card/list view -->
    <div class="mobile-list">
      <NuxtLink v-for="row in data?.rows" :key="row.id" :to="`/transactions/${row.id}`" class="tx-card">
        <div class="tx-card-header">
          <strong>{{ row.party?.name ?? 'General entry' }}</strong>
          <small>{{ formatDate(row.date) }}</small>
        </div>
        <p v-if="row.description" class="tx-desc">{{ row.description }}</p>
        <div v-if="visibleFields.length" class="tx-field-grid">
          <div v-for="f in visibleFields" :key="f.key" class="tx-field-cell">
            <span class="tx-field-label">{{ f.label }}</span>
            <span class="tx-field-value num">{{ display(row.fields[f.key]) }}</span>
          </div>
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
  </div>
</template>

<script setup lang="ts">
import { BookOpen } from '@lucide/vue'
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
.mobile-list { display: flex; flex-direction: column; gap: 10px; }
.tx-card {
  display: block;
  background: white;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 14px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.tx-card:active { border-color: var(--ink-900); box-shadow: var(--shadow-card); }
.tx-card-header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
.tx-card-header strong { font-size: 15px; }
.tx-card-header small { color: var(--ink-400); white-space: nowrap; }
.tx-desc { margin: 0 0 8px; color: var(--ink-700); font-size: 13px; }
.tx-field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}
.tx-field-cell { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.tx-field-label { font-size: 11px; color: var(--ink-400); font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
.tx-field-value { font-size: 14px; color: var(--ink-900); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.desktop-table { display: none; }
.pager { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 16px; }


@media (min-width: 900px) {
  .mobile-list { display: none; }
  .desktop-table { display: block; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); font-size: 14px; }
  tbody tr:hover { background: var(--paper-100); cursor: pointer; }
}
</style>
