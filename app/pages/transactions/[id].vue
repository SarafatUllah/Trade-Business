<template>
  <div v-if="data">
    <div class="card summary">
      <div>
        <strong>{{ data.party?.name ?? 'General entry' }}</strong>
        <small>{{ formatDate(data.date) }}</small>
      </div>
      <button class="btn secondary" @click="editing = !editing">{{ editing ? 'Cancel' : 'Edit' }}</button>
    </div>

    <template v-if="!editing">
      <div class="card field-list">
        <div v-for="f in data.fieldDefs" :key="f.id" class="row">
          <span class="label">{{ f.label }}</span>
          <span class="value num">{{ display(data.fields[f.key]) }}</span>
        </div>
        <div v-if="!data.fieldDefs.length" class="empty-state">No custom fields configured yet.</div>
      </div>

      <div class="bridge-actions">
        <p class="bridge-hint">
          Ledger entries and Payable/Receivable records are kept separate on purpose (so historical
          transaction data is never silently changed by payment activity). To track money owed for
          this entry, create a linked record:
        </p>
        <div class="bridge-buttons">
          <NuxtLink v-if="data.party" :to="`/receivables/new?partyId=${data.party.id}&transactionId=${data.id}`" class="btn receivable">+ Receivable</NuxtLink>
          <NuxtLink v-if="data.party" :to="`/payables/new?partyId=${data.party.id}&transactionId=${data.id}`" class="btn payable">+ Payable</NuxtLink>
        </div>
        <p v-if="!data.party" class="bridge-hint muted">Assign a party to this entry first to link a payable/receivable.</p>
      </div>

      <button class="btn secondary block danger" @click="onArchive">Archive entry</button>
    </template>

    <form v-else @submit.prevent="onSave">
      <div class="field">
        <label>Date</label>
        <input v-model="editDate" type="date" required />
      </div>
      <div class="field">
        <label>Description</label>
        <input v-model="editDescription" type="text" />
      </div>
      <DynamicFieldInput
        v-for="f in data.fieldDefs"
        :key="f.id"
        :field="f"
        :model-value="f.type === 'FORMULA' ? undefined : editValues[f.key]"
        :computed-value="f.type === 'FORMULA' ? liveFormulas[f.key] : undefined"
        @update:model-value="(v) => (editValues[f.key] = v)"
      />
      <button class="btn block" type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save changes' }}</button>
    </form>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const editing = ref(false)
const saving = ref(false)

const { data, refresh } = await useFetch(`/api/transactions/${route.params.id}`)

const editDate = ref('')
const editDescription = ref('')
const editValues = reactive<Record<string, unknown>>({})
const inputFields = computed(() => (data.value?.fieldDefs ?? []).filter((f: any) => f.type !== 'FORMULA'))
const fieldDefsRef = computed(() => data.value?.fieldDefs ?? [])
const liveFormulas = useLiveFormulas(fieldDefsRef, editValues)

watch(data, (val) => {
  if (!val) return
  editDate.value = new Date(val.date).toISOString().slice(0, 10)
  editDescription.value = val.description ?? ''
  for (const f of inputFields.value) editValues[f.key] = val.fields[f.key]
}, { immediate: true })

async function onSave() {
  saving.value = true
  try {
    await $fetch(`/api/transactions/${route.params.id}`, {
      method: 'PATCH',
      body: { date: editDate.value, description: editDescription.value, fields: editValues }
    })
    editing.value = false
    await refresh()
  } finally {
    saving.value = false
  }
}

async function onArchive() {
  if (!confirm('Archive this ledger entry? It will be removed from active views but kept in history.')) return
  await $fetch(`/api/transactions/${route.params.id}`, { method: 'DELETE' })
  router.push('/transactions')
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
function display(v: unknown) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return String(v)
}
</script>

<style scoped>
.summary { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.summary small { display: block; color: var(--ink-400); margin-top: 2px; }
.field-list { margin-bottom: 16px; }
.row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--line); }
.row:last-child { border-bottom: none; }
.label { color: var(--ink-400); font-size: 14px; }
.bridge-actions { margin-bottom: 16px; }
.bridge-hint { font-size: 13px; color: var(--ink-400); margin: 0 0 10px; line-height: 1.5; }
.bridge-hint.muted { text-align: center; }
.bridge-buttons { display: flex; gap: 10px; margin-bottom: 12px; }
.bridge-buttons .btn { flex: 1; }
.danger { background: var(--overdue-600); }
</style>
