<template>
  <div v-if="data">
    <div class="card summary receivable-bg">
      <small>Receivable from {{ data.party.name }}</small>
      <strong class="num">{{ format(data.remaining) }} <span class="of">of {{ format(data.originalAmount) }}</span></strong>
      <span class="pill" :class="data.status === 'OVERDUE' ? 'overdue' : 'receivable'">{{ data.status.replace('_', ' ') }}</span>
      <small>Expected {{ formatDate(data.expectedDate) }}</small>
      <p v-if="data.notes" class="core-notes">{{ data.notes }}</p>
    </div>

    <form v-if="data.remaining > 0" class="card pay-form" @submit.prevent="onCollect">
      <h3>Record collection</h3>
      <div class="field">
        <label>Amount received</label>
        <input v-model.number="amount" type="number" step="0.01" min="0.01" required :max="data.remaining" />
      </div>
      <div class="field">
        <label>Method</label>
        <select v-model="method">
          <option value="">Not specified</option>
          <option value="cash">Cash</option>
          <option value="bank">Bank transfer</option>
          <option value="mobile">Mobile banking</option>
        </select>
      </div>
      <p v-if="collectError" class="error">{{ collectError }}</p>
      <button class="btn receivable block" type="submit" :disabled="collecting"><span>{{ collecting ? 'Recording…' : 'Record collection' }}</span><ButtonSpinner v-if="collecting" /></button>
    </form>
    <p v-else class="settled">✓ Fully received — reminders stopped.</p>

    <div class="section-header">
      <h3 class="section-title">Details</h3>
      <button class="btn secondary small" @click="toggleEdit">{{ editing ? 'Cancel' : 'Edit' }}</button>
    </div>

    <div v-if="!editing" class="card field-list">
      <div class="row">
        <span class="label">Amount receivable</span>
        <span class="value num">{{ format(data.originalAmount) }}</span>
      </div>
      <div class="row">
        <span class="label">Expected date</span>
        <span class="value num">{{ formatDate(data.expectedDate) }}</span>
      </div>
      <div class="row">
        <span class="label">Notes</span>
        <span class="value">{{ data.notes || '—' }}</span>
      </div>
      <div v-for="f in data.fieldDefs" :key="f.id" class="row">
        <span class="label">{{ f.label }}</span>
        <span class="value num">{{ display(data.fields[f.key]) }}</span>
      </div>
    </div>

    <form v-else class="card edit-form" @submit.prevent="onSaveDetails">
      <div class="field">
        <label>Amount receivable<span class="req">*</span></label>
        <input
          v-model.number="editAmount" type="number" step="0.01" min="0.01" required
          :class="{ invalid: forceValidate && !editAmount }"
        />
        <FieldMessage v-if="forceValidate && !editAmount" type="error" message="Enter an amount greater than 0" />
      </div>
      <div class="field">
        <label>Expected date<span class="req">*</span></label>
        <input v-model="editExpectedDate" type="date" required :class="{ invalid: forceValidate && !editExpectedDate }" />
        <FieldMessage v-if="forceValidate && !editExpectedDate" type="error" message="Expected date is required" />
      </div>
      <div class="field">
        <label>Notes</label>
        <textarea v-model="editNotes" rows="2" />
      </div>

      <DynamicFieldInput
        v-for="f in data.fieldDefs"
        :key="f.id"
        :field="f"
        :model-value="f.type === 'FORMULA' ? undefined : editValues[f.key]"
        :computed-value="f.type === 'FORMULA' ? liveFormulas[f.key] : undefined"
        :force-validate="forceValidate"
        @update:model-value="(v) => (editValues[f.key] = v)"
      />
      <p v-if="editError" class="error">{{ editError }}</p>
      <button class="btn block" type="submit" :disabled="savingDetails">
        <span>{{ savingDetails ? 'Saving…' : 'Save details' }}</span>
        <ButtonSpinner v-if="savingDetails" />
      </button>
    </form>

    <h3 class="section-title">Collection history</h3>
    <div class="card list-card">
      <p v-if="!data.collections.length" class="empty-state">No collections yet.</p>
      <div v-for="c in data.collections" :key="c.id" class="ledger-row" :class="{ overdue: c.reversedAt }">
        <div class="row-main">
          <strong :class="{ struck: c.reversedAt }">{{ format(c.amount) }}</strong>
          <small>{{ formatDate(c.receivedAt) }} <span v-if="c.method">· {{ c.method }}</span></small>
          <small v-if="c.reversedAt" class="reversed">Reversed: {{ c.reversalReason }}</small>
        </div>
        <button v-if="!c.reversedAt" class="btn secondary small" @click="reverse(c.id)">Reverse</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { format } = useCurrency()
const { data, refresh } = await useFetch(`/api/receivables/${route.params.id}`)

const amount = ref<number | null>(null)
const method = ref('')
const collecting = ref(false)
const collectError = ref('')

const editing = ref(false)
const editValues = reactive<Record<string, unknown>>({})
const editAmount = ref<number | null>(null)
const editExpectedDate = ref('')
const editNotes = ref('')
const savingDetails = ref(false)
const editError = ref('')
const forceValidate = ref(false)
const fieldDefsRef = computed(() => data.value?.fieldDefs ?? [])
const liveFormulas = useLiveFormulas(fieldDefsRef, editValues)

function toggleEdit() {
  editing.value = !editing.value
  forceValidate.value = false
  editError.value = ''
  if (editing.value && data.value) {
    editAmount.value = data.value.originalAmount
    editExpectedDate.value = new Date(data.value.expectedDate).toISOString().slice(0, 10)
    editNotes.value = data.value.notes || ''
    for (const f of data.value.fieldDefs) {
      editValues[f.key] = data.value.fields[f.key] ?? (f.type === 'BOOLEAN' ? false : '')
    }
  }
}

async function onSaveDetails() {
  forceValidate.value = true
  const missingCore = !editAmount.value || !editExpectedDate.value
  const missingCustom = fieldDefsRef.value.some((f: any) => {
    if (!f.isRequired || f.type === 'FORMULA') return false
    const v = editValues[f.key]
    return v === undefined || v === null || v === ''
  })
  if (missingCore || missingCustom) {
    editError.value = 'Please fill in all required fields, highlighted below.'
    return
  }
  savingDetails.value = true
  editError.value = ''
  try {
    await $fetch(`/api/receivables/${route.params.id}`, {
      method: 'PATCH',
      body: { originalAmount: editAmount.value, expectedDate: editExpectedDate.value, notes: editNotes.value || null, fields: editValues }
    })
    editing.value = false
    await refresh()
  } catch (e: any) {
    editError.value = e?.data?.statusMessage || 'Could not save these details.'
  } finally {
    savingDetails.value = false
  }
}

async function onCollect() {
  collecting.value = true
  collectError.value = ''
  try {
    await $fetch(`/api/receivables/${route.params.id}/collections`, {
      method: 'POST',
      body: { amount: amount.value, method: method.value || undefined }
    })
    amount.value = null
    await refresh()
  } catch (e: any) {
    collectError.value = e?.data?.statusMessage || 'Could not record this collection.'
  } finally {
    collecting.value = false
  }
}

async function reverse(collectionId: string) {
  const reason = prompt('Reason for reversing this collection?')
  if (!reason) return
  await $fetch(`/api/receivables/${route.params.id}/collections/${collectionId}/reverse`, { method: 'POST', body: { reason } })
  await refresh()
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
.summary { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.summary.receivable-bg { border-left: 4px solid var(--receivable-600); }
.summary small { color: var(--ink-400); }
.summary strong { font-size: 24px; }
.of { font-size: 14px; color: var(--ink-400); font-weight: 400; }
.core-notes { font-size: 13px; color: var(--ink-700); margin: 4px 0 0; padding-top: 8px; border-top: 1px solid var(--line); }
.pay-form { margin-bottom: 16px; }
.pay-form h3 { font-size: 15px; margin-bottom: 12px; }
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.settled { text-align: center; color: var(--receivable-600); font-weight: 600; padding: 16px 0; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin: 16px 0 8px; }
.section-title { font-size: 15px; margin: 0; color: var(--ink-700); }
.field-list { margin-bottom: 16px; }
.field-list .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--line); }
.field-list .row:last-child { border-bottom: none; }
.field-list .label { color: var(--ink-400); font-size: 14px; }
.edit-form { margin-bottom: 16px; }
.list-card { padding: 4px 12px; }
.row-main { display: flex; flex-direction: column; gap: 2px; }
.row-main small { color: var(--ink-400); }
.struck { text-decoration: line-through; opacity: 0.5; }
.reversed { color: var(--overdue-600); }
.btn.small { padding: 6px 10px; min-height: auto; font-size: 12px; box-shadow: none; }
.req { color: var(--overdue-600); margin-left: 2px; }
</style>
