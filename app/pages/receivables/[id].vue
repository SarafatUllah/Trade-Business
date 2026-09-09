<template>
  <div v-if="data">
    <div class="card summary receivable-bg">
      <small>Receivable from {{ data.party.name }}</small>
      <strong class="num">{{ format(data.remaining) }} <span class="of">of {{ format(data.originalAmount) }}</span></strong>
      <span class="pill" :class="data.status === 'OVERDUE' ? 'overdue' : 'receivable'">{{ data.status.replace('_', ' ') }}</span>
      <small>Expected {{ formatDate(data.expectedDate) }}</small>
    </div>

    <form v-if="data.remaining > 0" class="card pay-form" @submit.prevent="onCollect">
      <h3>Record collection</h3>
      <div class="field">
        <label>Amount received</label>
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
      <p v-if="collectError" class="error">{{ collectError }}</p>
      <button class="btn receivable block" type="submit" :disabled="collecting">{{ collecting ? 'Recording…' : 'Record collection' }}</button>
    </form>
    <p v-else class="settled">✓ Fully received — reminders stopped.</p>

    <h3 class="section-title">Collection history</h3>
    <div class="card list-card">
      <p v-if="!data.collections.length" class="empty-state">No collections yet.</p>
      <div v-for="c in data.collections" :key="c.id" class="ledger-row" :class="{ overdue: c.reversedAt }">
        <div class="row-main">
          <strong :class="{ struck: c.reversedAt }">{{ format(c.amount) }}</strong>
          <small>{{ formatDate(c.receivedAt) }} <span v-if="c.method">· {{ c.method }}</span></small>
          <small v-if="c.reversedAt" class="reversed">Reversed: {{ c.reversalReason }}</small>
        </div>
        <button v-if="!c.reversedAt" class="btn secondary small" @click="reverse(c.id)">Reverse</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { format } = useCurrency()
const { data, refresh } = await useFetch(`/api/receivables/${route.params.id}`)

const amount = ref<number | null>(null)
const method = ref('')
const collecting = ref(false)
const collectError = ref('')

async function onCollect() {
  collecting.value = true
  collectError.value = ''
  try {
    await $fetch(`/api/receivables/${route.params.id}/collections`, {
      method: 'POST',
      body: { amount: amount.value, method: method.value || undefined }
    })
    amount.value = null
    await refresh()
  } catch (e: any) {
    collectError.value = e?.data?.statusMessage || 'Could not record this collection.'
  } finally {
    collecting.value = false
  }
}

async function reverse(collectionId: string) {
  const reason = prompt('Reason for reversing this collection?')
  if (!reason) return
  await $fetch(`/api/receivables/${route.params.id}/collections/${collectionId}/reverse`, { method: 'POST', body: { reason } })
  await refresh()
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.summary { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.summary.receivable-bg { border-left: 4px solid var(--receivable-600); }
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
