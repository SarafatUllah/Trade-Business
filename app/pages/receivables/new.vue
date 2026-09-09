<template>
  <form @submit.prevent="onSubmit">
    <div class="field">
      <label>Party / Mill</label>
      <select v-model="partyId" required>
        <option value="" disabled>Select party…</option>
        <option v-for="p in parties" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
    </div>
    <div class="field">
      <label>Amount receivable</label>
      <input v-model.number="originalAmount" type="number" step="0.01" min="0.01" required />
    </div>
    <div class="field">
      <label>Expected receive date</label>
      <input v-model="expectedDate" type="date" required />
    </div>
    <div class="field">
      <label>Remind me</label>
      <div class="chips">
        <button
          v-for="opt in reminderOptions" :key="opt.value" type="button"
          class="chip" :class="{ active: reminderDays.includes(opt.value) }"
          @click="toggleReminder(opt.value)"
        >{{ opt.label }}</button>
      </div>
    </div>
    <div class="field">
      <label>Notes</label>
      <textarea v-model="notes" rows="2" />
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <button class="btn receivable block" type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save receivable' }}</button>
  </form>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { data: parties } = await useFetch('/api/parties')

const partyId = ref((route.query.partyId as string) || '')
const transactionId = (route.query.transactionId as string) || undefined
const originalAmount = ref<number | null>(null)
const expectedDate = ref('')
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

async function onSubmit() {
  saving.value = true
  error.value = ''
  try {
    const receivable = await $fetch('/api/receivables', {
      method: 'POST',
      body: {
        partyId: partyId.value,
        originalAmount: originalAmount.value,
        expectedDate: expectedDate.value,
        notes: notes.value || undefined,
        transactionId,
        reminderDaysBefore: reminderDays.value
      }
    })
    router.push(`/receivables/${receivable.id}`)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not save this receivable.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  border: 1px solid var(--line);
  background: white;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-700);
}
.chip.active { background: var(--ink-900); color: white; border-color: var(--ink-900); }
</style>
