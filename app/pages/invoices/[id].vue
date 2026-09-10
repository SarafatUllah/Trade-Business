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

    <h3 class="section-title">Entries ({{ data.rows.length }})</h3>

    <!-- Deliberately NOT a <table>. A table's intrinsic minimum width is
         driven by its columns, which on a narrow phone forces the whole
         page column wider than the viewport — the layout can't help but
         overflow no matter how the wrapper is styled. Rendering each
         entry as a stacked label/value card removes the wide-content
         problem at its source instead of trying to contain it. -->
    <div v-for="(row, i) in data.rows" :key="i" class="card entry-card">
      <div class="entry-index">#{{ i + 1 }}</div>
      <div v-for="c in data.columns" :key="c.key" class="entry-row">
        <span class="entry-label">{{ c.label }}</span>
        <span class="entry-value num">{{ display(row[c.key]) }}</span>
      </div>
    </div>

    <h3 class="section-title">Summary</h3>
    <div class="card summary">
      <div class="row"><span class="label">Total Amount</span><span class="value num">{{ format(data.summary?.totalAmount ?? 0) }}</span></div>
      <div class="row"><span class="label">Total Paid</span><span class="value num">{{ format(data.summary?.totalPaid ?? 0) }}</span></div>
      <div class="row"><span class="label">Total Received</span><span class="value num">{{ format(data.summary?.totalReceived ?? 0) }}</span></div>
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
  const s = String(v)
  // Snapshot values keep raw ISO dates; show them readably rather than
  // as "2026-09-01T00:00:00.000Z".
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(s)) {
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return s
}
</script>

<style scoped>
.invoice-head { margin-bottom: 16px; }
.invoice-head h2 { font-size: 20px; }
.invoice-head p { margin: 2px 0 0; }
.muted { color: var(--ink-400); font-size: 13px; }

.section-title { font-size: 15px; margin: 0 0 8px; color: var(--ink-700); }

.entry-card { position: relative; margin-bottom: 12px; padding-top: 14px; }
.entry-index {
  font-size: 11px; font-weight: 700; color: var(--ink-400);
  margin-bottom: 8px;
}
.entry-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 12px;
  padding: 7px 0;
  border-bottom: 1px solid var(--line);
}
.entry-row:last-child { border-bottom: none; }
.entry-label { color: var(--ink-400); font-size: 13px; min-width: 0; }
.entry-value { text-align: right; font-weight: 600; min-width: 0; overflow-wrap: anywhere; }

.summary { margin-bottom: 16px; }
.summary .row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 7px 0;
}
.summary .label { color: var(--ink-700); }
.summary .value { text-align: right; font-weight: 700; }
</style>
