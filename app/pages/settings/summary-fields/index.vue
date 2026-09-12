<template>
  <div>
    <p class="intro">Choose which totals show in the Summary on each party's page. Each line sums one Ledger field's values across that party's entries.</p>

    <button class="btn block" @click="showForm = !showForm">{{ showForm ? 'Cancel' : '+ Add summary line' }}</button>

    <form v-if="showForm" class="card full-bleed new-form" @submit.prevent="onCreate">
      <div class="field">
        <label>Label<span class="req">*</span></label>
        <input v-model="form.label" type="text" required placeholder="e.g. Total Amount" />
      </div>
      <div class="field">
        <label>Sum this field<span class="req">*</span></label>
        <select v-model="form.sourceKey" required>
          <option value="" disabled>Select a field…</option>
          <option v-for="f in summableFields" :key="f.key" :value="f.key">{{ f.label }}</option>
        </select>
        <small v-if="!summableFields.length" class="hint">No Number, Currency, or Formula Ledger fields exist yet — create one in Ledger fields & formulas first.</small>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn block" type="submit" :disabled="saving">
        <span>{{ saving ? 'Adding…' : 'Add' }}</span>
        <ButtonSpinner v-if="saving" />
      </button>
    </form>

    <div v-if="pending"><SkeletonLoader :rows="3" :row-height="70" /></div>
    <div v-else-if="!data?.length"><EmptyState :icon="Sigma" message="No summary lines yet" hint="Add one above — e.g. 'Total Amount' summing your Due field." /></div>

    <div v-else class="card full-bleed list-card">
      <div v-for="def in data" :key="def.id" class="def-row">
        <template v-if="editingId !== def.id">
          <div class="row-main">
            <strong>{{ def.label }}</strong>
            <small>Sums "{{ fieldLabel(def.sourceKey) }}"</small>
          </div>
          <div class="row-actions">
            <button class="btn secondary small" @click="startEdit(def)">Edit</button>
            <button class="btn secondary small danger" @click="onDelete(def)">Delete</button>
          </div>
        </template>
        <form v-else class="edit-panel" @submit.prevent="onSaveEdit(def)">
          <div class="field">
            <label>Label</label>
            <input v-model="editForm.label" type="text" required />
          </div>
          <div class="field">
            <label>Sum this field</label>
            <select v-model="editForm.sourceKey" required>
              <option v-for="f in summableFields" :key="f.key" :value="f.key">{{ f.label }}</option>
            </select>
          </div>
          <p v-if="editError" class="error">{{ editError }}</p>
          <div class="edit-actions">
            <button class="btn secondary" type="button" @click="editingId = null">Cancel</button>
            <button class="btn" type="submit" :disabled="savingEdit">Save</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Sigma } from '@lucide/vue'

const { data, pending, refresh } = await useFetch('/api/summary-fields')
const { data: transactionFields } = await useFetch('/api/fields', { query: { entity: 'TRANSACTION' } })

const summableFields = computed(() =>
  (transactionFields.value ?? []).filter((f: any) => ['NUMBER', 'CURRENCY', 'FORMULA'].includes(f.type))
)
function fieldLabel(key: string) {
  return (transactionFields.value ?? []).find((f: any) => f.key === key)?.label ?? key
}

const showForm = ref(false)
const saving = ref(false)
const error = ref('')
const form = reactive({ label: '', sourceKey: '' })

async function onCreate() {
  saving.value = true
  error.value = ''
  try {
    await $fetch('/api/summary-fields', { method: 'POST', body: { ...form } })
    form.label = ''
    form.sourceKey = ''
    showForm.value = false
    await refresh()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not add this summary line.'
  } finally {
    saving.value = false
  }
}

const editingId = ref<string | null>(null)
const editForm = reactive({ label: '', sourceKey: '' })
const savingEdit = ref(false)
const editError = ref('')

function startEdit(def: any) {
  editingId.value = def.id
  editForm.label = def.label
  editForm.sourceKey = def.sourceKey
  editError.value = ''
}

async function onSaveEdit(def: any) {
  savingEdit.value = true
  editError.value = ''
  try {
    await $fetch(`/api/summary-fields/${def.id}`, { method: 'PATCH', body: { ...editForm } })
    editingId.value = null
    await refresh()
  } catch (e: any) {
    editError.value = e?.data?.statusMessage || 'Could not save changes.'
  } finally {
    savingEdit.value = false
  }
}

async function onDelete(def: any) {
  if (!confirm(`Delete the "${def.label}" summary line? This only removes it from view — it won't affect your data.`)) return
  await $fetch(`/api/summary-fields/${def.id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<style scoped>
.intro { color: var(--ink-400); font-size: 13px; margin-bottom: 14px; line-height: 1.4; }
.new-form { margin: 14px 0; }
.req { color: var(--overdue-600); margin-left: 2px; }
.hint { color: var(--ink-400); font-size: 12px; display: block; margin-top: 4px; }
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.list-card { padding: 4px 14px; margin-top: 16px; }
.def-row { border-bottom: 1px solid var(--line); }
.def-row:last-child { border-bottom: none; }
.row-main { display: flex; flex-direction: column; gap: 2px; padding: 14px 0 6px; }
.row-main small { color: var(--ink-400); }
.row-actions { display: flex; gap: 8px; padding-bottom: 12px; }
.btn.small { padding: 6px 10px; min-height: auto; font-size: 12px; box-shadow: none; }
.btn.danger { color: var(--overdue-600); }
.edit-panel { padding: 10px 0 16px; }
.edit-actions { display: flex; gap: 8px; margin-top: 4px; }
.edit-actions .btn { flex: 1; }
</style>
