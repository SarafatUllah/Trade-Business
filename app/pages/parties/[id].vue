<template>
  <div v-if="data">
    <div class="card full-bleed party-header">
      <div class="header-top">
        <div>
          <h2>{{ data.party.name }}</h2>
          <span class="pill" :class="data.party.type === 'SELLER' ? 'receivable' : 'payable'">{{ data.party.type }}</span>
        </div>
        <button class="btn secondary small" @click="toggleEdit">{{ editing ? 'Cancel' : 'Edit' }}</button>
      </div>
      <template v-if="!editing">
        <p v-if="data.party.phone">{{ data.party.phone }}</p>
        <p v-if="data.party.address" class="muted">{{ data.party.address }}</p>
      </template>

      <form v-else class="edit-form" @submit.prevent="onSaveEdit">
        <div class="field">
          <label>Type</label>
          <div class="type-toggle">
            <button type="button" class="type-btn seller" :class="{ active: editForm.type === 'SELLER' }" @click="editForm.type = 'SELLER'">Seller</button>
            <button type="button" class="type-btn buyer" :class="{ active: editForm.type === 'BUYER' }" @click="editForm.type = 'BUYER'">Buyer</button>
          </div>
        </div>
        <div class="field"><label>Name</label><input v-model="editForm.name" type="text" required /></div>
        <div class="field"><label>Phone</label><input v-model="editForm.phone" type="tel" required /></div>
        <div class="field"><label>Address</label><textarea v-model="editForm.address" rows="2" /></div>
        <div class="field"><label>Notes</label><textarea v-model="editForm.notes" rows="2" /></div>
        <p v-if="editError" class="error">{{ editError }}</p>
        <button class="btn block" type="submit" :disabled="savingEdit"><span>{{ savingEdit ? 'Saving…' : 'Save changes' }}</span><ButtonSpinner v-if="savingEdit" /></button>
      </form>
    </div>

    <template v-if="!editing">
      <div class="stat-row">
        <div v-if="data.party.type === 'SELLER'" class="stat card receivable-bg full">
          <small>You will receive</small>
          <strong class="num">{{ format(data.summary.outstandingReceivable) }}</strong>
        </div>
        <div v-else class="stat card payable-bg full">
          <small>You have to pay</small>
          <strong class="num">{{ format(data.summary.outstandingPayable) }}</strong>
        </div>
      </div>

      <div class="quick-actions">
        <NuxtLink v-if="data.party.type === 'SELLER'" :to="`/receivables/new?partyId=${data.party.id}`" class="btn receivable block">+ Receivable</NuxtLink>
        <NuxtLink v-else :to="`/payables/new?partyId=${data.party.id}`" class="btn payable block">+ Payable</NuxtLink>
      </div>

      <h3 class="section-title">{{ data.party.type === 'SELLER' ? 'Receivables' : 'Payables' }}</h3>
      <div class="card full-bleed list-card">
        <template v-if="data.party.type === 'SELLER'">
          <p v-if="!data.receivables.length" class="empty-state">None yet.</p>
          <NuxtLink v-for="r in data.receivables" :key="r.id" :to="`/receivables/${r.id}`" class="ledger-row" :class="{ overdue: r.status === 'OVERDUE' }">
            <div class="row-main">
              <span class="pill" :class="r.status === 'OVERDUE' ? 'overdue' : 'receivable'">{{ r.status.replace('_', ' ') }}</span>
              <small>Expected {{ formatDate(r.expectedDate) }}</small>
            </div>
            <span class="num receivable-text">{{ format(r.remaining) }}</span>
          </NuxtLink>
        </template>
        <template v-else>
          <p v-if="!data.payables.length" class="empty-state">None yet.</p>
          <NuxtLink v-for="p in data.payables" :key="p.id" :to="`/payables/${p.id}`" class="ledger-row" :class="{ overdue: p.status === 'OVERDUE' }">
            <div class="row-main">
              <span class="pill" :class="p.status === 'OVERDUE' ? 'overdue' : 'payable'">{{ p.status.replace('_', ' ') }}</span>
              <small>Due {{ formatDate(p.dueDate) }}</small>
            </div>
            <span class="num payable-text">{{ format(p.remaining) }}</span>
          </NuxtLink>
        </template>
      </div>

      <h3 class="section-title">Entries ({{ data.entries.length }})</h3>
      <EmptyState v-if="!data.entries.length" :icon="FileText" message="No ledger entries yet" />
      <div v-for="(entry, i) in data.entries" :key="entry.id" class="card entry-card">
        <NuxtLink :to="`/transactions/${entry.id}`" class="entry-index-row">
          <span class="entry-index">#{{ i + 1 }} · {{ formatDate(entry.date) }}</span>
          <ChevronRight :size="16" :stroke-width="2.2" class="chevron" />
        </NuxtLink>
        <div v-if="entry.description" class="entry-row">
          <span class="entry-label">Description</span>
          <span class="entry-value">{{ entry.description }}</span>
        </div>
        <div v-for="f in data.entryFieldDefs" :key="f.key" class="entry-row">
          <span class="entry-label">{{ f.label }}</span>
          <span class="entry-value num">{{ displayField(entry.fields[f.key]) }}</span>
        </div>
      </div>

      <h3 class="section-title">Summary</h3>
      <div class="card full-bleed summary">
        <template v-if="data.party.type === 'SELLER'">
          <div class="row"><span class="label">Total Amount</span><span class="value num">{{ format(data.summary.totalReceivable) }}</span></div>
          <div class="row"><span class="label">Total Received</span><span class="value num">{{ format(data.summary.totalReceived) }}</span></div>
        </template>
        <template v-else>
          <div class="row"><span class="label">Total Amount</span><span class="value num">{{ format(data.summary.totalPayable) }}</span></div>
          <div class="row"><span class="label">Total Payable</span><span class="value num">{{ format(data.summary.outstandingPayable) }}</span></div>
        </template>
      </div>

      <h3 class="section-title">Invoices</h3>
      <div class="card full-bleed list-card">
        <p v-if="!data.invoices.length" class="empty-state">No invoices generated yet.</p>
        <NuxtLink v-for="i in data.invoices" :key="i.id" :to="`/invoices/${i.id}`" class="ledger-row">
          <div class="row-main">
            <strong>{{ i.invoiceNumber }}</strong>
            <small>{{ formatDate(i.createdAt) }}</small>
          </div>
          <span class="num">{{ format(i.totalAmount) }}</span>
        </NuxtLink>
      </div>

      <NuxtLink :to="`/invoices/new?partyId=${data.party.id}`" class="btn block generate-invoice">Generate invoice</NuxtLink>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight, FileText } from '@lucide/vue'
const route = useRoute()
const { format } = useCurrency()
const { data, refresh } = await useFetch(`/api/parties/${route.params.id}`)

const editing = ref(false)
const editForm = reactive({ type: 'SELLER' as 'SELLER' | 'BUYER', name: '', phone: '', address: '', notes: '' })
const savingEdit = ref(false)
const editError = ref('')

function toggleEdit() {
  editing.value = !editing.value
  editError.value = ''
  if (editing.value && data.value) {
    editForm.type = data.value.party.type
    editForm.name = data.value.party.name
    editForm.phone = data.value.party.phone || ''
    editForm.address = data.value.party.address || ''
    editForm.notes = data.value.party.notes || ''
  }
}

async function onSaveEdit() {
  savingEdit.value = true
  editError.value = ''
  try {
    await $fetch(`/api/parties/${route.params.id}`, { method: 'PATCH', body: { ...editForm } })
    editing.value = false
    await refresh()
  } catch (e: any) {
    editError.value = e?.data?.statusMessage || 'Could not save changes.'
  } finally {
    savingEdit.value = false
  }
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function displayField(v: unknown) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return String(v)
}
</script>

<style scoped>
.party-header { margin-bottom: 12px; }
.header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.party-header h2 { font-size: 20px; margin-bottom: 6px; }
.party-header p { margin: 8px 0 0; color: var(--ink-400); }
.muted { font-size: 13px; }
.btn.small { padding: 6px 10px; min-height: auto; font-size: 12px; box-shadow: none; flex-shrink: 0; }

.edit-form { margin-top: 14px; }
.type-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.type-btn { padding: 10px; border-radius: var(--radius-sm); border: 1.5px solid var(--line); background: white; font-weight: 600; font-size: 13px; }
.type-btn.seller.active { border-color: var(--receivable-600); background: var(--receivable-100); color: var(--receivable-600); }
.type-btn.buyer.active { border-color: var(--payable-600); background: var(--payable-100); color: var(--payable-600); }
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }

.stat-row { margin-bottom: 12px; }
.stat { display: flex; flex-direction: column; gap: 4px; }
.stat.full { width: 100%; }
.stat small { color: var(--ink-400); font-size: 12px; font-weight: 600; }
.stat strong { font-size: 22px; }
.quick-actions { margin-bottom: 18px; }
.section-title { font-size: 15px; margin: 16px 0 8px; color: var(--ink-700); }
.list-card { padding: 4px 12px; }
.row-main { display: flex; flex-direction: column; gap: 4px; }
.row-main small { color: var(--ink-400); }
.receivable-text { color: var(--receivable-600); font-weight: 700; }
.payable-text { color: var(--payable-600); font-weight: 700; }

.entry-card { margin-bottom: 12px; padding-top: 12px; }
.entry-index-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.entry-index { font-size: 11px; font-weight: 700; color: var(--ink-400); }
.chevron { color: var(--ink-400); }
.entry-row {
  display: grid; grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline; gap: 12px; padding: 7px 0;
  border-bottom: 1px solid var(--line);
}
.entry-row:last-child { border-bottom: none; }
.entry-label { color: var(--ink-400); font-size: 13px; min-width: 0; }
.entry-value { text-align: right; font-weight: 600; min-width: 0; overflow-wrap: anywhere; }

.summary { margin-bottom: 8px; }
.summary .row {
  display: grid; grid-template-columns: minmax(0, 1fr) auto;
  align-items: center; gap: 12px; padding: 7px 0;
}
.summary .label { color: var(--ink-700); }
.summary .value { text-align: right; font-weight: 700; }

.generate-invoice { margin-top: 20px; }
</style>
