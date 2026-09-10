<template>
  <div v-if="data">
    <div class="card summary payable-bg">
      <small>Payable to {{ data.party.name }}</small>
      <strong class="num">{{ format(data.remaining) }} <span class="of">of {{ format(data.originalAmount) }}</span></strong>
      <span class="pill" :class="data.status === 'OVERDUE' ? 'overdue' : 'payable'">{{ data.status.replace('_', ' ') }}</span>
      <small>Due {{ formatDate(data.dueDate) }}</small>
    </div>

    <form v-if="data.remaining > 0" class="card pay-form" @submit.prevent="onPay">
      <h3>Record payment</h3>
      <div class="field">
        <label>Amount paid</label>
        <input v-model.number="amount" type="number" step="0.01" min="0.01" required :max="data.remaining" />
      </div>
      <div class="field">
        <label>Method</label>
        <select v-model="method">
          <option value="">Not specified</option>
          <option value="cash">Cash</option>
          <option value="bank">Bank transfer</option>
          <option value="mobile">Mobile banking</option>
        </select>
      </div>
      <p v-if="payError" class="error">{{ payError }}</p>
      <button class="btn payable block" type="submit" :disabled="paying"><span>{{ paying ? 'Recording…' : 'Record payment' }}</span><ButtonSpinner v-if="paying" /></button>
    </form>
    <p v-else class="settled">✓ Fully paid — reminders stopped.</p>

    <h3 class="section-title">Payment history</h3>
    <div class="card list-card">
      <p v-if="!data.payments.length" class="empty-state">No payments yet.</p>
      <div v-for="p in data.payments" :key="p.id" class="ledger-row" :class="{ overdue: p.reversedAt }">
        <div class="row-main">
          <strong :class="{ struck: p.reversedAt }">{{ format(p.amount) }}</strong>
          <small>{{ formatDate(p.paidAt) }} <span v-if="p.method">· {{ p.method }}</span></small>
          <small v-if="p.reversedAt" class="reversed">Reversed: {{ p.reversalReason }}</small>
        </div>
        <button v-if="!p.reversedAt" class="btn secondary small" @click="reverse(p.id)">Reverse</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { format } = useCurrency()
const { data, refresh } = await useFetch(`/api/payables/${route.params.id}`)

const amount = ref<number | null>(null)
const method = ref('')
const paying = ref(false)
const payError = ref('')

async function onPay() {
  paying.value = true
  payError.value = ''
  try {
    await $fetch(`/api/payables/${route.params.id}/payments`, {
      method: 'POST',
      body: { amount: amount.value, method: method.value || undefined }
    })
    amount.value = null
    await refresh()
  } catch (e: any) {
    payError.value = e?.data?.statusMessage || 'Could not record this payment.'
  } finally {
    paying.value = false
  }
}

async function reverse(paymentId: string) {
  const reason = prompt('Reason for reversing this payment?')
  if (!reason) return
  await $fetch(`/api/payables/${route.params.id}/payments/${paymentId}/reverse`, { method: 'POST', body: { reason } })
  await refresh()
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.summary { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.summary.payable-bg { border-left: 4px solid var(--payable-600); }
.summary small { color: var(--ink-400); }
.summary strong { font-size: 24px; }
.of { font-size: 14px; color: var(--ink-400); font-weight: 400; }
.pay-form { margin-bottom: 16px; }
.pay-form h3 { font-size: 15px; margin-bottom: 12px; }
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.settled { text-align: center; color: var(--receivable-600); font-weight: 600; padding: 16px 0; }
.section-title { font-size: 15px; margin: 16px 0 8px; color: var(--ink-700); }
.list-card { padding: 4px 12px; }
.row-main { display: flex; flex-direction: column; gap: 2px; }
.row-main small { color: var(--ink-400); }
.struck { text-decoration: line-through; opacity: 0.5; }
.reversed { color: var(--overdue-600); }
.btn.small { padding: 6px 10px; min-height: auto; font-size: 12px; }
</style>
