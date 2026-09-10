<template>
  <div class="card form-card">
    <div class="form-header">
      <div class="form-icon payable"><Wallet :size="20" :stroke-width="2.2" /></div>
      <div>
        <h2>Add Payable</h2>
        <p>Record money you need to pay to a party</p>
      </div>
    </div>

    <form @submit.prevent="onSubmit">
      <div class="field">
        <label>Party / Mill<span class="req">*</span></label>
        <select v-model="partyId" required :class="{ invalid: (touched.party || forceValidate) && !partyId }" @blur="touched.party = true">
          <option value="" disabled>Select party…</option>
          <option v-for="p in parties" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <FieldMessage v-if="(touched.party || forceValidate) && !partyId" type="error" message="Select a party" />
      </div>
      <div class="field">
        <label>Amount payable<span class="req">*</span></label>
        <input
          v-model.number="originalAmount" type="number" step="0.01" min="0.01" required
          :class="{ invalid: (touched.amount || forceValidate) && !originalAmount }" @blur="touched.amount = true"
        />
        <FieldMessage v-if="(touched.amount || forceValidate) && !originalAmount" type="error" message="Enter an amount greater than 0" />
      </div>
      <div class="field">
        <label>Due date<span class="req">*</span></label>
        <input
          v-model="dueDate" type="date" required
          :class="{ invalid: (touched.dueDate || forceValidate) && !dueDate }" @blur="touched.dueDate = true"
        />
        <FieldMessage v-if="(touched.dueDate || forceValidate) && !dueDate" type="error" message="Due date is required" />
      </div>
      <div class="field">
        <label>Remind me</label>
        <div class="chips">
          <button
            v-for="opt in reminderOptions" :key="opt.value" type="button"
            class="chip" :class="{ active: reminderDays.includes(opt.value) }"
            @click="toggleReminder(opt.value)"
          ><BellRing :size="13" :stroke-width="2.2" />{{ opt.label }}</button>
        </div>
      </div>
      <div class="field">
        <label>Notes</label>
        <textarea v-model="notes" rows="2" />
      </div>

      <DynamicFieldInput
        v-for="f in customFields"
        :key="f.id"
        :field="f"
        :model-value="f.type === 'FORMULA' ? undefined : fieldValues[f.key]"
        :computed-value="f.type === 'FORMULA' ? liveFormulas[f.key] : undefined"
        :force-validate="forceValidate"
        @update:model-value="(v) => (fieldValues[f.key] = v)"
      />

      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn payable block" type="submit" :disabled="saving"><span>{{ saving ? 'Saving…' : 'Save payable' }}</span><ButtonSpinner v-if="saving" /></button>
    </form>
    <NuxtLink to="/settings/fields" class="manage-link">
      <Settings2 :size="14" :stroke-width="2.2" /> Manage payable fields
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { Wallet, BellRing, Settings2 } from '@lucide/vue'
const route = useRoute()
const router = useRouter()
const { data: parties } = await useFetch('/api/parties')
const { data: customFieldsData } = await useFetch('/api/fields', { query: { entity: 'PAYABLE' } })
const customFields = computed(() => customFieldsData.value ?? [])
const fieldValues = reactive<Record<string, unknown>>({})
const liveFormulas = useLiveFormulas(customFields, fieldValues)
const forceValidate = ref(false)
const touched = reactive({ party: false, amount: false, dueDate: false })

watch(customFields, (list) => {
  for (const f of list) {
    if (f.type === 'FORMULA') continue
    if (!(f.key in fieldValues)) fieldValues[f.key] = f.type === 'BOOLEAN' ? false : ''
  }
}, { immediate: true })

const partyId = ref((route.query.partyId as string) || '')
const transactionId = (route.query.transactionId as string) || undefined
const originalAmount = ref<number | null>(null)
const dueDate = ref('')
const notes = ref('')
const saving = ref(false)
const error = ref('')

const reminderOptions = [
  { value: 3, label: '3 days before' },
  { value: 2, label: '2 days before' },
  { value: 1, label: '1 day before' },
  { value: 0, label: 'Same day' },
  { value: 7, label: '7 days before' }
]
const reminderDays = ref<number[]>([1, 0])
function toggleReminder(v: number) {
  const idx = reminderDays.value.indexOf(v)
  if (idx >= 0) reminderDays.value.splice(idx, 1)
  else reminderDays.value.push(v)
}

function hasMissingRequiredField() {
  return customFields.value.some(f => {
    if (!f.isRequired || f.type === 'FORMULA') return false
    const v = fieldValues[f.key]
    return v === undefined || v === null || v === ''
  })
}

async function onSubmit() {
  forceValidate.value = true
  if (!partyId.value || !originalAmount.value || !dueDate.value || hasMissingRequiredField()) {
    error.value = 'Please fill in all required fields, highlighted below.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const payable = await $fetch('/api/payables', {
      method: 'POST',
      body: {
        partyId: partyId.value,
        originalAmount: originalAmount.value,
        dueDate: dueDate.value,
        notes: notes.value || undefined,
        transactionId,
        reminderDaysBefore: reminderDays.value,
        fields: fieldValues
      }
    })
    router.push(`/payables/${payable.id}`)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not save this payable.'
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
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.form-icon.payable { background: var(--payable-100); color: var(--payable-600); }
.form-header h2 { font-size: 17px; margin: 0; }
.form-header p { font-size: 13px; color: var(--ink-400); margin: 2px 0 0; }
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1.5px solid var(--line);
  background: white;
  border-radius: 999px;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-700);
}
.chip.active { background: var(--ink-900); color: white; border-color: var(--ink-900); }
.manage-link {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  text-align: center; margin-top: 20px; color: var(--focus); font-size: 14px; font-weight: 600;
}
.req { color: var(--overdue-600); margin-left: 2px; }
</style>
