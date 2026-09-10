<template>
  <div>
    <div class="tabs">
      <button v-for="e in entities" :key="e" class="tab-btn" :class="{ active: entity === e }" @click="entity = e; loadFields()">
        {{ labels[e] }}
      </button>
    </div>

    <div class="card list-card">
      <div v-if="!fields.length"><EmptyState :icon="ListPlus" :message="`No fields yet for ${labels[entity].toLowerCase()}`" hint="Tap '+ Add field' below to create your first custom column." /></div>
      <div v-for="f in fields" :key="f.id" class="field-row" :class="{ editing: editingId === f.id }">
        <div class="field-row-top" @click="toggleEdit(f)">
          <div class="row-main">
            <strong>{{ f.label }} <small class="type-tag">{{ f.type }} · {{ f.key }}</small></strong>
            <small v-if="f.formula" class="formula-text">= {{ f.formula }}</small>
            <small class="flags">
              <span v-if="f.showInTable" class="flag-pill">In table</span>
              <span v-if="f.showInInvoice" class="flag-pill">In invoice</span>
              <span v-if="f.isFilterable" class="flag-pill">Filterable</span>
              <span v-if="f.isRequired" class="flag-pill">Required</span>
            </small>
          </div>
          <span class="chevron" :class="{ open: editingId === f.id }">▾</span>
        </div>

        <div v-if="editingId === f.id" class="field-edit-panel">
          <div class="field">
            <label>Label</label>
            <input v-model="editForm.label" type="text" />
          </div>
          <div class="field">
            <label>Key (used in formulas)</label>
            <input v-model="editForm.key" type="text" pattern="^[a-z][a-z0-9_]*$" />
            <small class="hint">Renaming automatically updates any formulas that reference this key.</small>
          </div>
          <div class="field">
            <label>Type</label>
            <select v-model="editForm.type">
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
            <small v-if="editForm.type !== f.type" class="hint warn">
              Changing type will try to convert existing saved values — double-check your data afterward.
            </small>
          </div>
          <label class="checkbox-row"><input v-model="editForm.isRequired" type="checkbox" /> <span>Required</span></label>
          <div v-if="editForm.type === 'FORMULA'" class="field formula-builder">
            <label>Formula</label>
            <input v-model="editForm.formula" type="text" />
            <small>Tap a field to insert it:</small>
            <div class="chips">
              <button
                v-for="ref in referenceableFields(f)" :key="ref.key" type="button" class="chip"
                @click="editForm.formula += (editForm.formula ? ' ' : '') + ref.key"
              >{{ ref.label }}</button>
              <button type="button" class="chip op" @click="editForm.formula += ' + '">+</button>
              <button type="button" class="chip op" @click="editForm.formula += ' - '">−</button>
              <button type="button" class="chip op" @click="editForm.formula += ' * '">×</button>
              <button type="button" class="chip op" @click="editForm.formula += ' / '">÷</button>
              <button type="button" class="chip op" @click="editForm.formula += '('">(</button>
              <button type="button" class="chip op" @click="editForm.formula += ')'">)</button>
            </div>
          </div>
          <div v-if="['DROPDOWN', 'STATUS'].includes(editForm.type)" class="field">
            <label>Options (comma separated)</label>
            <input v-model="editOptionsInput" type="text" />
          </div>
          <label class="checkbox-row"><input v-model="editForm.showInTable" type="checkbox" /> <span>Show in table</span></label>
          <label class="checkbox-row"><input v-model="editForm.showInInvoice" type="checkbox" /> <span>Show in invoice</span></label>
          <label class="checkbox-row"><input v-model="editForm.isFilterable" type="checkbox" /> <span>Usable as filter</span></label>
          <p v-if="editError" class="error">{{ editError }}</p>
          <div class="edit-actions">
            <button class="btn secondary" type="button" @click="editingId = null">Cancel</button>
            <button class="btn" type="button" :disabled="editSaving" @click="saveEdit(f)"><span>{{ editSaving ? 'Saving…' : 'Save changes' }}</span><ButtonSpinner v-if="editSaving" /></button>
            <button class="btn danger" type="button" @click="archiveField(f)">Archive</button>
          </div>
        </div>
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
          <button v-for="f in existingFields" :key="f.key" type="button" class="chip" @click="form.formula += (form.formula ? ' ' : '') + f.key">{{ f.label }}</button>
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
      <button class="btn block" type="submit" :disabled="saving"><span>{{ saving ? 'Saving…' : 'Add field' }}</span><ButtonSpinner v-if="saving" /></button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ListPlus } from '@lucide/vue'
type Entity = 'TRANSACTION' | 'PAYABLE' | 'RECEIVABLE'
const entities: Entity[] = ['TRANSACTION', 'PAYABLE', 'RECEIVABLE']
const labels: Record<Entity, string> = { TRANSACTION: 'Ledger', PAYABLE: 'Payable', RECEIVABLE: 'Receivable' }

const entity = ref<Entity>('TRANSACTION')
const fields = ref<any[]>([])
const showForm = ref(false)
const saving = ref(false)
const error = ref('')
const optionsInput = ref('')

const editingId = ref<string | null>(null)
const editForm = reactive<{ label: string; key: string; type: string; formula: string; showInTable: boolean; showInInvoice: boolean; isFilterable: boolean; isRequired: boolean }>({
  label: '', key: '', type: 'TEXT', formula: '', showInTable: false, showInInvoice: false, isFilterable: false, isRequired: false
})
const editOptionsInput = ref('')
const editSaving = ref(false)
const editError = ref('')

const form = reactive({
  label: '', key: '', type: 'TEXT', formula: '',
  isRequired: false, showInTable: true, showInInvoice: false, isFilterable: false
})

// Fields you can tap to insert into a formula — shows the human label
// (e.g. "Weight") instead of the raw key (e.g. "w"), which is what
// actually gets inserted, so the builder is legible even with terse keys.
const existingFields = computed(() => fields.value.filter(f => f.type !== 'FORMULA').map(f => ({ key: f.key, label: f.label })))
function referenceableFields(current: any) {
  return existingFields.value.filter(f => f.key !== current.key)
}

async function loadFields() {
  try {
    fields.value = await $fetch('/api/fields', { query: { entity: entity.value } })
  } catch (e: any) {
    if (e?.response?.status === 401) return navigateTo('/login')
    throw e
  }
  editingId.value = null
}
await loadFields()

function toggleEdit(f: any) {
  if (editingId.value === f.id) { editingId.value = null; return }
  editingId.value = f.id
  editError.value = ''
  editForm.label = f.label
  editForm.key = f.key
  editForm.type = f.type
  editForm.formula = f.formula || ''
  editForm.showInTable = f.showInTable
  editForm.showInInvoice = f.showInInvoice
  editForm.isFilterable = f.isFilterable
  editForm.isRequired = f.isRequired
  editOptionsInput.value = f.options ? JSON.parse(f.options).map((o: any) => o.label).join(', ') : ''
}

async function saveEdit(f: any) {
  editSaving.value = true
  editError.value = ''
  try {
    const options = ['DROPDOWN', 'STATUS'].includes(editForm.type)
      ? editOptionsInput.value.split(',').map(s => s.trim()).filter(Boolean).map(v => ({ value: v, label: v }))
      : undefined
    await $fetch(`/api/fields/${f.id}`, {
      method: 'PATCH',
      body: {
        label: editForm.label,
        key: editForm.key !== f.key ? editForm.key : undefined,
        type: editForm.type !== f.type ? editForm.type : undefined,
        formula: editForm.type === 'FORMULA' ? editForm.formula : undefined,
        showInTable: editForm.showInTable,
        showInInvoice: editForm.showInInvoice,
        isFilterable: editForm.isFilterable,
        isRequired: editForm.isRequired,
        options
      }
    })
    await loadFields()
  } catch (e: any) {
    editError.value = e?.data?.statusMessage || 'Could not save changes.'
  } finally {
    editSaving.value = false
  }
}

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
  if (!confirm(`Archive "${f.label}"? It will be hidden from new entries but historical data is kept. You can create a new field with the same key afterward.`)) return
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
.tab-btn { flex: 1; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: white; font-weight: 600; font-size: 13px; color: var(--ink-700); transition: background 0.15s, color 0.15s, border-color 0.15s; }
.tab-btn.active { background: var(--ink-900); color: white; border-color: var(--ink-900); }
.list-card { padding: 4px 12px; margin-bottom: 16px; }
.field-row { border-bottom: 1px solid var(--line); }
.field-row:last-child { border-bottom: none; }
.field-row-top { display: flex; align-items: center; gap: 10px; padding: 14px 4px; cursor: pointer; }
.field-row.editing .field-row-top { background: var(--paper-100); margin: 0 -4px; padding: 14px 8px; border-radius: var(--radius-sm) var(--radius-sm) 0 0; }
.row-main { display: flex; flex-direction: column; gap: 3px; flex: 1; }
.type-tag { color: var(--ink-400); font-weight: 400; }
.formula-text { font-family: var(--font-num); color: var(--focus); }
.flags { display: flex; gap: 6px; flex-wrap: wrap; }
.flag-pill { background: var(--paper-100); color: var(--ink-700); padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.chevron { color: var(--ink-400); transition: transform 0.2s; font-size: 14px; }
.chevron.open { transform: rotate(180deg); }
.field-edit-panel { padding: 4px 8px 16px; background: var(--paper-100); border-radius: 0 0 var(--radius-sm) var(--radius-sm); margin: 0 -4px 8px; animation: expand 0.15s ease-out; }
@keyframes expand { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.edit-actions { display: flex; gap: 8px; margin-top: 12px; }
.edit-actions .btn { flex: 1; }
.btn.danger { background: var(--overdue-600); }
.btn.small { padding: 6px 10px; min-height: auto; font-size: 12px; }
.new-field-form { margin-top: 12px; }
.formula-builder small { color: var(--ink-400); display: block; margin: 6px 0; }
.hint { color: var(--ink-400); font-size: 12px; margin-top: 4px; display: block; }
.hint.warn { color: var(--payable-600); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { border: 1px solid var(--line); background: white; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 600; transition: background 0.15s, color 0.15s; }
.chip.op { background: var(--paper-100); }
.chip:active { background: var(--ink-900); color: white; }
.checkbox-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 14px; }
.checkbox-row input { width: 18px; height: 18px; }
.error { color: var(--overdue-600); font-size: 14px; margin: 6px 0; }
</style>
