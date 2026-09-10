<template>
  <form @submit.prevent="onSubmit">
    <div class="field">
      <label for="name">Party / Mill name</label>
      <input id="name" v-model="name" type="text" required />
    </div>
    <div class="field">
      <label for="phone">Phone</label>
      <input id="phone" v-model="phone" type="tel" />
    </div>
    <div class="field">
      <label for="address">Address</label>
      <textarea id="address" v-model="address" rows="2" />
    </div>
    <div class="field">
      <label for="notes">Notes</label>
      <textarea id="notes" v-model="notes" rows="2" />
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <button class="btn block" type="submit" :disabled="saving"><span>{{ saving ? 'Saving…' : 'Save party' }}</span><ButtonSpinner v-if="saving" /></button>
  </form>
</template>

<script setup lang="ts">
const name = ref('')
const phone = ref('')
const address = ref('')
const notes = ref('')
const saving = ref(false)
const error = ref('')
const router = useRouter()

async function onSubmit() {
  saving.value = true
  error.value = ''
  try {
    const party = await $fetch('/api/parties', {
      method: 'POST',
      body: { name: name.value, phone: phone.value || undefined, address: address.value || undefined, notes: notes.value || undefined }
    })
    router.push(`/parties/${party.id}`)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not save this party.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
</style>
