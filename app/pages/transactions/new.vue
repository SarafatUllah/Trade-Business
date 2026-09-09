<template>
  <div>
    <form @submit.prevent="onSubmit">
      <div class="field">
        <label for="date">Date</label>
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
        v-for="f in inputFields"
        :key="f.id"
        :field="f"
        v-model="values[f.key]"
      />

      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn block" type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save entry' }}</button>
    </form>

    <NuxtLink to="/settings/fields" class="manage-link">+ Manage ledger fields</NuxtLink>
  </div>
</template>

<script setup lang="ts">
const date = ref(new Date().toISOString().slice(0, 10))
const partyId = ref('')
const description = ref('')
const values = reactive<Record<string, unknown>>({})
const saving = ref(false)
const error = ref('')

const { data: parties } = await useFetch('/api/parties')
const { data: fields } = await useFetch('/api/fields', { query: { entity: 'TRANSACTION' } })
const inputFields = computed(() => (fields.value ?? []).filter((f: any) => f.type !== 'FORMULA'))

const router = useRouter()

async function onSubmit() {
  saving.value = true
  error.value = ''
  try {
    const tx = await $fetch('/api/transactions', {
      method: 'POST',
      body: { date: date.value, partyId: partyId.value || undefined, description: description.value || undefined, fields: values }
    })
    router.push(`/transactions/${tx.id}`)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not save this entry.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.manage-link { display: block; text-align: center; margin-top: 20px; color: var(--focus); font-size: 14px; font-weight: 600; }
</style>
