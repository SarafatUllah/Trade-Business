<template>
  <div class="card form-card">
    <div class="form-header">
      <div class="form-icon"><BookOpen :size="20" :stroke-width="2.2" /></div>
      <div>
        <h2>Add Ledger Entry</h2>
        <p>Record a transaction in your business ledger</p>
      </div>
    </div>

    <p v-if="savedCount > 0" class="saved-banner">
      <CircleCheck :size="16" :stroke-width="2.2" /> {{ savedCount }} {{ savedCount === 1 ? 'entry' : 'entries' }} saved this session
    </p>

    <form @submit.prevent="onSubmit">
      <div class="field">
        <label for="date">Date<span class="req">*</span></label>
        <input id="date" v-model="date" type="date" required />
      </div>
      <div class="field">
        <label for="party">Party (optional)</label>
        <select id="party" v-model="partyId">
          <option value="">No party</option>
          <option v-for="p in parties" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div class="field">
        <label for="description">Description</label>
        <input id="description" v-model="description" type="text" placeholder="e.g. Rice delivery, 3 trucks" />
      </div>

      <DynamicFieldInput
        v-for="f in fields"
        :key="f.id"
        :field="f"
        :model-value="['FORMULA','AUTO_STATUS'].includes(f.type) ? undefined : values[f.key]"
        :computed-value="['FORMULA','AUTO_STATUS'].includes(f.type) ? liveFormulas[f.key] : undefined"
        :force-validate="forceValidate"
        @update:model-value="(v) => (values[f.key] = v)"
      />

      <p v-if="error" class="error">{{ error }}</p>

      <div class="btn-row">
        <button class="btn secondary" type="button" :disabled="saving" @click="onSubmit(true)">
          <span>{{ saving ? 'Saving…' : 'Save & add another' }}</span>
          <ButtonSpinner v-if="saving" />
        </button>
        <button class="btn" type="submit" :disabled="saving">
          <span>{{ saving ? 'Saving…' : 'Save & finish' }}</span>
          <ButtonSpinner v-if="saving" />
        </button>
      </div>
    </form>

    <NuxtLink to="/settings/fields" class="manage-link">
      <Settings2 :size="14" :stroke-width="2.2" /> Manage ledger fields
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { BookOpen, Settings2, CircleCheck } from '@lucide/vue'
const route = useRoute()
const router = useRouter()

const date = ref(new Date().toISOString().slice(0, 10))
const partyId = ref((route.query.partyId as string) || '')
const description = ref('')
const values = reactive<Record<string, unknown>>({})
const saving = ref(false)
const error = ref('')
const forceValidate = ref(false)
const savedCount = ref(0)

const { data: parties } = await useFetch('/api/parties')
const { data: fieldsData } = await useFetch('/api/fields', { query: { entity: 'TRANSACTION' } })
const fields = computed(() => fieldsData.value ?? [])
const liveFormulas = useLiveFormulas(fields, values)

// Explicitly seed every input field to a real "empty" value rather than
// leaving it `undefined` — native <select> elements fall back to
// displaying their first <option> when bound to undefined, which looked
// like an unintended default was pre-selected even though nothing was.
watch(fields, (list) => {
  for (const f of list) {
    if (['FORMULA','AUTO_STATUS'].includes(f.type)) continue
    if (!(f.key in values)) {
      values[f.key] = f.type === 'BOOLEAN' ? false : ''
    }
  }
}, { immediate: true })

// Duplicate-from: pre-fills every field's value from an existing entry
// (party/description/date + all custom fields), so entering a very
// similar delivery doesn't mean retyping everything — only the few
// fields that actually differ need changing. Date defaults to today
// rather than copying the source's date, since a duplicate is normally
// for a NEW day's similar delivery.
const duplicateFromId = route.query.duplicateFrom as string | undefined
if (duplicateFromId) {
  try {
    const source = await $fetch(`/api/transactions/${duplicateFromId}`)
    if (!partyId.value) partyId.value = source.partyId || ''
    description.value = source.description || ''
    await nextTick() // ensure the seed-defaults watcher above has run first
    for (const f of fields.value) {
      if (['FORMULA','AUTO_STATUS'].includes(f.type)) continue
      if (source.fields[f.key] !== undefined && source.fields[f.key] !== null) {
        values[f.key] = source.fields[f.key]
      }
    }
  } catch {
    // Source entry not found/inaccessible — just proceed with a blank form.
  }
}

function hasMissingRequiredField() {
  return fields.value.some(f => {
    if (!f.isRequired || ['FORMULA','AUTO_STATUS'].includes(f.type)) return false
    const v = values[f.key]
    return v === undefined || v === null || v === ''
  })
}

function resetEntryFields() {
  // Deliberately keeps Date and Party — the whole point of "Save & add
  // another" is entering several similar deliveries for the same
  // party/day in a row without re-picking them each time.
  description.value = ''
  for (const f of fields.value) {
    if (['FORMULA','AUTO_STATUS'].includes(f.type)) continue
    values[f.key] = f.type === 'BOOLEAN' ? false : ''
  }
  forceValidate.value = false
}

async function onSubmit(addAnother = false) {
  forceValidate.value = true
  if (hasMissingRequiredField()) {
    error.value = 'Please fill in all required fields, highlighted below.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const tx = await $fetch('/api/transactions', {
      method: 'POST',
      body: { date: date.value, partyId: partyId.value || undefined, description: description.value || undefined, fields: values }
    })
    if (addAnother) {
      savedCount.value++
      resetEntryFields()
    } else {
      router.push(`/transactions/${tx.id}`)
    }
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not save this entry.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.form-card { padding: 20px; }
.form-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.form-icon {
  width: 44px; height: 44px; border-radius: var(--radius-sm);
  background: var(--paper-100); color: var(--accent);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.form-header h2 { font-size: 17px; margin: 0; }
.form-header p { font-size: 13px; color: var(--ink-400); margin: 2px 0 0; }
.saved-banner {
  display: flex; align-items: center; gap: 8px;
  background: var(--receivable-100); color: var(--receivable-600);
  padding: 10px 14px; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 600; margin-bottom: 16px;
}
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.btn-row { display: flex; gap: 10px; }
.btn-row .btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; }
.manage-link {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  text-align: center; margin-top: 20px; color: var(--focus); font-size: 14px; font-weight: 600;
}
.req { color: var(--overdue-600); margin-left: 2px; }
</style>
