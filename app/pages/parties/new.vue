<template>
  <div class="card full-bleed form-card">
    <div class="form-header">
      <div class="form-icon"><Factory :size="20" :stroke-width="2.2" /></div>
      <div>
        <h2>Add Party</h2>
        <p>Add a new Mill or trading partner</p>
      </div>
    </div>

    <form @submit.prevent="onSubmit">
      <div class="field">
        <label>Type<span class="req">*</span></label>
        <div class="type-toggle">
          <button type="button" class="type-btn seller" :class="{ active: type === 'SELLER' }" @click="type = 'SELLER'">
            <strong>Seller</strong>
            <small>You sell to them — creates Receivables</small>
          </button>
          <button type="button" class="type-btn buyer" :class="{ active: type === 'BUYER' }" @click="type = 'BUYER'">
            <strong>Buyer</strong>
            <small>You buy from them — creates Payables</small>
          </button>
        </div>
        <small class="hint">If the same mill/person is both, add them twice — once as each type.</small>
      </div>
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
  </div>
</template>

<script setup lang="ts">
import { Factory } from '@lucide/vue'
const type = ref<'SELLER' | 'BUYER'>('SELLER')
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
      body: { type: type.value, name: name.value, phone: phone.value, address: address.value || undefined, notes: notes.value || undefined }
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
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.req { color: var(--overdue-600); margin-left: 2px; }
.hint { color: var(--ink-400); font-size: 12px; display: block; margin-top: 6px; }

.type-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.type-btn {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px; border-radius: var(--radius-sm);
  border: 1.5px solid var(--line); background: white; text-align: left;
}
.type-btn strong { font-size: 14px; }
.type-btn small { font-size: 11px; color: var(--ink-400); line-height: 1.3; }
.type-btn.seller.active { border-color: var(--receivable-600); background: var(--receivable-100); }
.type-btn.buyer.active { border-color: var(--payable-600); background: var(--payable-100); }
</style>
