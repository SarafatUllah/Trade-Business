<template>
  <div v-if="data">
    <div class="card invoice-head">
      <h2>{{ data.invoiceNumber }}</h2>
      <p>{{ data.business.name }}</p>
      <p class="muted">Bill to: {{ data.party.name }}</p>
      <p v-if="data.periodStart" class="muted">
        Period: {{ formatDate(data.periodStart) }} – {{ formatDate(data.periodEnd) }}
      </p>
    </div>

    <div class="card table-wrap">
      <table>
        <thead>
          <tr><th v-for="c in data.columns" :key="c.key">{{ c.label }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in data.rows" :key="i">
            <td v-for="c in data.columns" :key="c.key">{{ display(row[c.key]) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card summary">
      <div class="row"><span>Total Amount</span><strong class="num">{{ format(data.summary.totalAmount) }}</strong></div>
      <div class="row"><span>Total Paid</span><strong class="num">{{ format(data.summary.totalPaid) }}</strong></div>
      <div class="row"><span>Total Received</span><strong class="num">{{ format(data.summary.totalReceived) }}</strong></div>
    </div>

    <a :href="`/api/invoices/${route.params.id}/pdf`" class="btn block" target="_blank" rel="noopener">
      Download PDF
    </a>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { format } = useCurrency()
const { data } = await useFetch(`/api/invoices/${route.params.id}`)

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function display(v: unknown) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return String(v)
}
</script>

<style scoped>
.invoice-head { margin-bottom: 12px; }
.invoice-head h2 { font-size: 20px; }
.invoice-head p { margin: 2px 0 0; }
.muted { color: var(--ink-400); font-size: 13px; }
.table-wrap { overflow-x: auto; margin-bottom: 12px; -webkit-overflow-scrolling: touch; }
table { width: 100%; border-collapse: collapse; min-width: 480px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); font-size: 13px; }
.summary .row { display: flex; justify-content: space-between; padding: 6px 0; }
</style>
