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
      <button class="btn payable block danger" @click="onArchive">Archive entry</button>
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
        v-for="f in inputFields"
        :key="f.id"
        :field="f"
        v-model="editValues[f.key]"
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
.danger { background: var(--overdue-600); }
</style>
