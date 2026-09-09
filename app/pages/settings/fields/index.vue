<template>
  <div>
    <div class="tabs">
      <button v-for="e in entities" :key="e" class="tab-btn" :class="{ active: entity === e }" @click="entity = e; loadFields()">
        {{ labels[e] }}
      </button>
    </div>

    <div class="card list-card">
      <p v-if="!fields.length" class="empty-state">No fields yet for {{ labels[entity].toLowerCase() }}.</p>
      <div v-for="f in fields" :key="f.id" class="ledger-row">
        <div class="row-main">
          <strong>{{ f.label }} <small class="type-tag">{{ f.type }}</small></strong>
          <small v-if="f.formula" class="formula-text">= {{ f.formula }}</small>
          <small class="flags">
            <span v-if="f.showInTable">In table</span>
            <span v-if="f.showInInvoice">In invoice</span>
            <span v-if="f.isFilterable">Filterable</span>
          </small>
        </div>
        <button class="btn secondary small" @click="archiveField(f)">Archive</button>
      </div>
    </div>

    <button class="btn block" @click="showForm = !showForm">{{ showForm ? 'Cancel' : '+ Add field' }}</button>

    <form v-if="showForm" class="card new-field-form" @submit.prevent="onCreate">
      <div class="field">
        <label>Label</label>
        <input v-model="form.label" type="text" required placeholder="e.g. Truck Rent" @input="autoKey" />
      </div>
      <div class="field">
        <label>Key (used in formulas)</label>
        <input v-model="form.key" type="text" required pattern="^[a-z][a-z0-9_]*$" placeholder="truck_rent" />
      </div>
      <div class="field">
        <label>Type</label>
        <select v-model="form.type">
          <option value="TEXT">Text</option>
          <option value="LONG_TEXT">Long text</option>
          <option value="NUMBER">Number</option>
          <option value="CURRENCY">Currency</option>
          <option value="DATE">Date</option>
          <option value="DATETIME">Date &amp; time</option>
          <option value="DROPDOWN">Dropdown</option>
          <option value="STATUS">Status</option>
          <option value="BOOLEAN">Yes / No</option>
          <option value="FORMULA">Formula (calculated)</option>
        </select>
      </div>

      <div v-if="form.type === 'FORMULA'" class="field formula-builder">
        <label>Formula</label>
        <input v-model="form.formula" type="text" placeholder="e.g. weight * rate" />
        <small>Tap a field to insert it:</small>
        <div class="chips">
          <button v-for="k in existingKeys" :key="k" type="button" class="chip" @click="form.formula += (form.formula ? ' ' : '') + k">{{ k }}</button>
          <button type="button" class="chip op" @click="form.formula += ' + '">+</button>
          <button type="button" class="chip op" @click="form.formula += ' - '">−</button>
          <button type="button" class="chip op" @click="form.formula += ' * '">×</button>
          <button type="button" class="chip op" @click="form.formula += ' / '">÷</button>
          <button type="button" class="chip op" @click="form.formula += '('">(</button>
          <button type="button" class="chip op" @click="form.formula += ')'">)</button>
        </div>
      </div>

      <div v-if="['DROPDOWN', 'STATUS'].includes(form.type)" class="field">
        <label>Options (comma separated)</label>
        <input v-model="optionsInput" type="text" placeholder="e.g. Pending, In Transit, Delivered" />
      </div>

      <label class="checkbox-row"><input v-model="form.isRequired" type="checkbox" /> <span>Required</span></label>
      <label class="checkbox-row"><input v-model="form.showInTable" type="checkbox" /> <span>Show in table</span></label>
      <label class="checkbox-row"><input v-model="form.showInInvoice" type="checkbox" /> <span>Show in invoice</span></label>
      <label class="checkbox-row"><input v-model="form.isFilterable" type="checkbox" /> <span>Usable as filter</span></label>

      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn block" type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Add field' }}</button>
    </form>
  </div>
</template>

<script setup lang="ts">
type Entity = 'TRANSACTION' | 'PAYABLE' | 'RECEIVABLE'
const entities: Entity[] = ['TRANSACTION', 'PAYABLE', 'RECEIVABLE']
const labels: Record<Entity, string> = { TRANSACTION: 'Ledger', PAYABLE: 'Payable', RECEIVABLE: 'Receivable' }

const entity = ref<Entity>('TRANSACTION')
const fields = ref<any[]>([])
const showForm = ref(false)
const saving = ref(false)
const error = ref('')
const optionsInput = ref('')

const form = reactive({
  label: '', key: '', type: 'TEXT', formula: '',
  isRequired: false, showInTable: true, showInInvoice: false, isFilterable: false
})

const existingKeys = computed(() => fields.value.filter(f => f.type !== 'FORMULA').map(f => f.key))

async function loadFields() {
  fields.value = await $fetch('/api/fields', { query: { entity: entity.value } })
}
await loadFields()

function autoKey() {
  if (form.key) return
  form.key = form.label.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_')
}

async function onCreate() {
  saving.value = true
  error.value = ''
  try {
    const options = ['DROPDOWN', 'STATUS'].includes(form.type)
      ? optionsInput.value.split(',').map(s => s.trim()).filter(Boolean).map(v => ({ value: v, label: v }))
      : undefined
    await $fetch('/api/fields', {
      method: 'POST',
      body: { entity: entity.value, ...form, formula: form.type === 'FORMULA' ? form.formula : undefined, options }
    })
    Object.assign(form, { label: '', key: '', type: 'TEXT', formula: '', isRequired: false, showInTable: true, showInInvoice: false, isFilterable: false })
    optionsInput.value = ''
    showForm.value = false
    await loadFields()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not create this field.'
  } finally {
    saving.value = false
  }
}

async function archiveField(f: any) {
  if (!confirm(`Archive "${f.label}"? It will be hidden from new entries but historical data is kept.`)) return
  try {
    await $fetch(`/api/fields/${f.id}`, { method: 'PATCH', body: { isArchived: true } })
    await loadFields()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Could not archive this field.')
  }
}
</script>

<style scoped>
.tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.tab-btn { flex: 1; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: white; font-weight: 600; font-size: 13px; color: var(--ink-700); }
.tab-btn.active { background: var(--ink-900); color: white; border-color: var(--ink-900); }
.list-card { padding: 4px 12px; margin-bottom: 16px; }
.row-main { display: flex; flex-direction: column; gap: 3px; }
.type-tag { color: var(--ink-400); font-weight: 400; }
.formula-text { font-family: var(--font-num); color: var(--focus); }
.flags { display: flex; gap: 8px; color: var(--ink-400); }
.btn.small { padding: 6px 10px; min-height: auto; font-size: 12px; }
.new-field-form { margin-top: 12px; }
.formula-builder small { color: var(--ink-400); display: block; margin: 6px 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { border: 1px solid var(--line); background: white; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 600; }
.chip.op { background: var(--paper-100); }
.checkbox-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 14px; }
.checkbox-row input { width: 18px; height: 18px; }
.error { color: var(--overdue-600); font-size: 14px; margin: 6px 0; }
</style>
