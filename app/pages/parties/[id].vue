<template>
  <div v-if="data">
    <div class="card full-bleed party-header">
      <h2>{{ data.party.name }}</h2>
      <p v-if="data.party.phone">{{ data.party.phone }}</p>
      <p v-if="data.party.address" class="muted">{{ data.party.address }}</p>
    </div>

    <div class="stat-row">
      <div class="stat card receivable-bg">
        <small>You will receive</small>
        <strong class="num">{{ format(data.summary.outstandingReceivable) }}</strong>
      </div>
      <div class="stat card payable-bg">
        <small>You have to pay</small>
        <strong class="num">{{ format(data.summary.outstandingPayable) }}</strong>
      </div>
    </div>

    <div class="quick-actions">
      <NuxtLink :to="`/receivables/new?partyId=${data.party.id}`" class="btn receivable">+ Receivable</NuxtLink>
      <NuxtLink :to="`/payables/new?partyId=${data.party.id}`" class="btn payable">+ Payable</NuxtLink>
    </div>

    <h3 class="section-title">Receivables</h3>
    <div class="card full-bleed list-card">
      <p v-if="!data.receivables.length" class="empty-state">None yet.</p>
      <NuxtLink v-for="r in data.receivables" :key="r.id" :to="`/receivables/${r.id}`" class="ledger-row" :class="{ overdue: r.status === 'OVERDUE' }">
        <div class="row-main">
          <span class="pill" :class="r.status === 'OVERDUE' ? 'overdue' : 'receivable'">{{ r.status.replace('_', ' ') }}</span>
          <small>Expected {{ formatDate(r.expectedDate) }}</small>
        </div>
        <span class="num receivable-text">{{ format(r.remaining) }}</span>
      </NuxtLink>
    </div>

    <h3 class="section-title">Payables</h3>
    <div class="card full-bleed list-card">
      <p v-if="!data.payables.length" class="empty-state">None yet.</p>
      <NuxtLink v-for="p in data.payables" :key="p.id" :to="`/payables/${p.id}`" class="ledger-row" :class="{ overdue: p.status === 'OVERDUE' }">
        <div class="row-main">
          <span class="pill" :class="p.status === 'OVERDUE' ? 'overdue' : 'payable'">{{ p.status.replace('_', ' ') }}</span>
          <small>Due {{ formatDate(p.dueDate) }}</small>
        </div>
        <span class="num payable-text">{{ format(p.remaining) }}</span>
      </NuxtLink>
    </div>

    <h3 class="section-title">Recent transactions</h3>
    <div class="card full-bleed list-card">
      <p v-if="!data.transactions.length" class="empty-state">None yet.</p>
      <NuxtLink v-for="t in data.transactions" :key="t.id" :to="`/transactions/${t.id}`" class="ledger-row">
        <div class="row-main">
          <strong>{{ t.description || 'Entry' }}</strong>
          <small>{{ formatDate(t.date) }}</small>
        </div>
      </NuxtLink>
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
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { format } = useCurrency()
const { data } = await useFetch(`/api/parties/${route.params.id}`)

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.party-header { margin-bottom: 12px; }
.party-header h2 { font-size: 20px; }
.party-header p { margin: 2px 0 0; color: var(--ink-400); }
.muted { font-size: 13px; }
.stat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.stat { display: flex; flex-direction: column; gap: 4px; }
.stat small { color: var(--ink-400); font-size: 12px; font-weight: 600; }
.stat strong { font-size: 17px; }
.quick-actions { display: flex; gap: 10px; margin-bottom: 18px; }
.quick-actions .btn { flex: 1; }
.section-title { font-size: 15px; margin: 16px 0 8px; color: var(--ink-700); }
.list-card { padding: 4px 12px; }
.row-main { display: flex; flex-direction: column; gap: 4px; }
.row-main small { color: var(--ink-400); }
.receivable-text { color: var(--receivable-600); font-weight: 700; }
.payable-text { color: var(--payable-600); font-weight: 700; }
.generate-invoice { margin-top: 20px; }
</style>
