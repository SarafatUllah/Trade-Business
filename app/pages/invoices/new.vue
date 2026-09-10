<template>
  <div>
    <div class="field">
      <label>Party / Mill</label>
      <select v-model="partyId" @change="loadTransactions">
        <option value="" disabled>Select party…</option>
        <option v-for="p in parties" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
    </div>
    <div class="field-row">
      <div class="field">
        <label>From</label>
        <input v-model="periodStart" type="date" @change="loadTransactions" />
      </div>
      <div class="field">
        <label>To</label>
        <input v-model="periodEnd" type="date" @change="loadTransactions" />
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
const periodStart = ref('')
const periodEnd = ref('')
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
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { border: 1px solid var(--line); background: white; border-radius: 999px; padding: 8px 14px; font-size: 13px; font-weight: 600; color: var(--ink-700); }
.chip.active { background: var(--ink-900); color: white; border-color: var(--ink-900); }
.list-card { padding: 4px 12px; max-height: 260px; overflow-y: auto; }
.tx-row { gap: 10px; cursor: pointer; }
.tx-row input { width: 20px; height: 20px; }
.error { color: var(--overdue-600); font-size: 14px; margin: 8px 0; }
</style>
