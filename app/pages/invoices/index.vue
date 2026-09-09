<template>
  <div>
    <div v-if="pending"><SkeletonLoader :rows="4" :row-height="70" /></div>
    <div v-else-if="!data?.length"><EmptyState :icon="FileText" message="No invoices yet" hint="Generate one from a party's page." /></div>

    <div class="card list-card">
      <NuxtLink v-for="i in data" :key="i.id" :to="`/invoices/${i.id}`" class="ledger-row">
        <div class="row-main">
          <strong>{{ i.invoiceNumber }}</strong>
          <small>{{ i.party.name }} · {{ formatDate(i.createdAt) }}</small>
        </div>
        <span class="num">{{ format(i.totalAmount) }}</span>
      </NuxtLink>
    </div>

    <NuxtLink to="/invoices/new" class="btn block new-invoice">+ Generate invoice</NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { FileText } from '@lucide/vue'
const { format } = useCurrency()
const { data, pending } = await useFetch('/api/invoices')
function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.list-card { padding: 4px 12px; }
.row-main { display: flex; flex-direction: column; gap: 2px; }
.row-main small { color: var(--ink-400); }
.new-invoice { margin-top: 16px; }
</style>
