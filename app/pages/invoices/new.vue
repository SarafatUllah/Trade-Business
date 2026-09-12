<template>
  <div>
    <div class="field">
      <label>Party / Mill</label>
      <select v-model="partyId" @change="loadTransactions">
        <option value="" disabled>Select party…</option>
        <option v-for="p in parties" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
    </div>
    <div class="field">
      <label>Period</label>
      <div class="filter-mode-row">
        <button v-for="m in filterModes" :key="m.value" type="button" class="chip" :class="{ active: filterMode === m.value }" @click="filterMode = m.value">{{ m.label }}</button>
      </div>
    </div>

    <div v-if="filterMode === 'day'" class="field">
      <label>Day</label>
      <input v-model="filterDay" type="date" @change="loadTransactions" />
    </div>
    <div v-if="filterMode === 'month'" class="field">
      <label>Month</label>
      <input v-model="filterMonth" type="month" @change="loadTransactions" />
    </div>
    <div v-if="filterMode === 'year'" class="field">
      <label>Year</label>
      <input v-model="filterYear" type="number" min="2000" max="2100" step="1" @change="loadTransactions" />
    </div>
    <div v-if="filterMode === 'range'" class="field-row">
      <div class="field">
        <label>From</label>
        <input v-model="filterFrom" type="date" @change="loadTransactions" />
      </div>
      <div class="field">
        <label>To</label>
        <input v-model="filterTo" type="date" @change="loadTransactions" />
      </div>
    </div>

    <div v-if="partyId" class="field">
      <label>Columns to include</label>
      <div class="chips">
        <button
          v-for="f in allFields" :key="f.key" type="button"
          class="chip" :class="{ active: selectedColumns.includes(f.key) }"
          @click="toggleColumn(f.key)"
        >{{ f.label }}</button>
      </div>
    </div>

    <div v-if="transactions.length" class="field">
      <label>Transactions to include ({{ selectedTxIds.length }}/{{ transactions.length }})</label>
      <div class="card list-card">
        <label v-for="t in transactions" :key="t.id" class="ledger-row tx-row">
          <input type="checkbox" :value="t.id" v-model="selectedTxIds" />
          <span>{{ formatDate(t.date) }} — {{ t.description || 'Entry' }}</span>
        </label>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <button class="btn block" :disabled="!partyId || generating" @click="onGenerate">
      <span>{{ generating ? 'Generating…' : 'Preview & Generate Invoice' }}</span>
      <ButtonSpinner v-if="generating" />
    </button>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { data: parties } = await useFetch('/api/parties')
const { data: allFields } = await useFetch('/api/fields', { query: { entity: 'TRANSACTION' } })

const partyId = ref((route.query.partyId as string) || '')
const filterModes = [
  { value: '', label: 'All time' },
  { value: 'day', label: 'Day' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'range', label: 'Range' }
]
const filterMode = ref('')
const filterDay = ref('')
const filterMonth = ref('')
const filterYear = ref(new Date().getFullYear())
const filterFrom = ref('')
const filterTo = ref('')

// Derives the actual from/to dates sent to the server from whichever
// filter mode is active — kept as plain refs (not a computed) since
// they're what gets sent in the generate-invoice request body too.
const periodStart = computed(() => {
  if (filterMode.value === 'day') return filterDay.value
  if (filterMode.value === 'month' && filterMonth.value) {
    const [y, m] = filterMonth.value.split('-').map(Number)
    return new Date(y, m - 1, 1).toISOString().slice(0, 10)
  }
  if (filterMode.value === 'year' && filterYear.value) return `${filterYear.value}-01-01`
  if (filterMode.value === 'range') return filterFrom.value
  return ''
})
const periodEnd = computed(() => {
  if (filterMode.value === 'day') return filterDay.value
  if (filterMode.value === 'month' && filterMonth.value) {
    const [y, m] = filterMonth.value.split('-').map(Number)
    return new Date(y, m, 0).toISOString().slice(0, 10)
  }
  if (filterMode.value === 'year' && filterYear.value) return `${filterYear.value}-12-31`
  if (filterMode.value === 'range') return filterTo.value
  return ''
})
watch(filterMode, () => loadTransactions())
const transactions = ref<any[]>([])
const selectedTxIds = ref<string[]>([])
const selectedColumns = ref<string[]>([])
const generating = ref(false)
const error = ref('')

watch(allFields, (fields) => {
  selectedColumns.value = (fields ?? []).filter((f: any) => f.showInInvoice).map((f: any) => f.key)
}, { immediate: true })

function toggleColumn(key: string) {
  const idx = selectedColumns.value.indexOf(key)
  if (idx >= 0) selectedColumns.value.splice(idx, 1)
  else selectedColumns.value.push(key)
}

async function loadTransactions() {
  if (!partyId.value) return
  try {
    const res = await $fetch('/api/transactions', {
      query: { partyId: partyId.value, dateFrom: periodStart.value || undefined, dateTo: periodEnd.value || undefined, pageSize: 100 }
    })
    transactions.value = res.rows
    selectedTxIds.value = res.rows.map((r: any) => r.id)
  } catch (e: any) {
    if (e?.response?.status === 401) return navigateTo('/login')
    throw e
  }
}

if (partyId.value) await loadTransactions()

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

async function onGenerate() {
  generating.value = true
  error.value = ''
  try {
    const invoice = await $fetch('/api/invoices', {
      method: 'POST',
      body: {
        partyId: partyId.value,
        periodStart: periodStart.value || undefined,
        periodEnd: periodEnd.value || undefined,
        transactionIds: selectedTxIds.value,
        columnKeys: selectedColumns.value
      }
    })
    router.push(`/invoices/${invoice.id}`)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not generate this invoice.'
  } finally {
    generating.value = false
  }
}
</script>

<style scoped>
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.filter-mode-row { display: flex; flex-wrap: wrap; gap: 8px; }
.filter-mode-row .chip {
  padding: 7px 14px; border-radius: 999px; border: 1.5px solid var(--line);
  background: white; font-size: 13px; font-weight: 600; color: var(--ink-700);
}
.filter-mode-row .chip.active { background: var(--ink-900); color: white; border-color: var(--ink-900); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { border: 1px solid var(--line); background: white; border-radius: 999px; padding: 8px 14px; font-size: 13px; font-weight: 600; color: var(--ink-700); }
.chip.active { background: var(--ink-900); color: white; border-color: var(--ink-900); }
.list-card { padding: 4px 12px; max-height: 260px; overflow-y: auto; }
.tx-row { gap: 10px; cursor: pointer; }
.tx-row input { width: 20px; height: 20px; }
.error { color: var(--overdue-600); font-size: 14px; margin: 8px 0; }
</style>
