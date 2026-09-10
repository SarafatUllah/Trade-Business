<template>
  <form @submit.prevent="onSubmit">
    <div class="field">
      <label for="name">Party / Mill name<span class="req">*</span></label>
      <input
        id="name" v-model="name" type="text" required
        :class="{ invalid: (touched.name || forceValidate) && !name.trim() }" @blur="touched.name = true"
      />
      <FieldMessage v-if="(touched.name || forceValidate) && !name.trim()" type="error" message="Party/Mill name is required" />
    </div>
    <div class="field">
      <label for="phone">Phone<span class="req">*</span></label>
      <input
        id="phone" v-model="phone" type="tel" required
        :class="{ invalid: (touched.phone || forceValidate) && !phone.trim() }" @blur="touched.phone = true"
      />
      <FieldMessage v-if="(touched.phone || forceValidate) && !phone.trim()" type="error" message="Phone number is required" />
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
const forceValidate = ref(false)
const touched = reactive({ name: false, phone: false })
const router = useRouter()

async function onSubmit() {
  forceValidate.value = true
  if (!name.value.trim() || !phone.value.trim()) {
    error.value = 'Please fill in all required fields, highlighted below.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const party = await $fetch('/api/parties', {
      method: 'POST',
      body: { name: name.value, phone: phone.value, address: address.value || undefined, notes: notes.value || undefined }
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
.req { color: var(--overdue-600); margin-left: 2px; }
</style>
