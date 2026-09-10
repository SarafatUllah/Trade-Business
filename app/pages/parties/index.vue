<template>
  <div>
    <input v-model="search" type="search" placeholder="Search parties…" class="search-input" />

    <div v-if="pending"><SkeletonLoader :rows="4" :row-height="70" /></div>
    <div v-else-if="!filtered.length"><EmptyState :icon="Factory" message="No parties yet" hint="Tap the + button to add a Mill or trading partner." /></div>

    <div class="card list-card">
      <NuxtLink v-for="p in filtered" :key="p.id" :to="`/parties/${p.id}`" class="ledger-row">
        <div class="row-main">
          <strong>{{ p.name }}</strong>
          <small v-if="p.phone">{{ p.phone }}</small>
        </div>
        <div class="amounts">
          <span v-if="p.outstandingReceivable > 0" class="pill receivable">Receive {{ format(p.outstandingReceivable) }}</span>
          <span v-if="p.outstandingPayable > 0" class="pill payable">Pay {{ format(p.outstandingPayable) }}</span>
        </div>
      </NuxtLink>
    </div>

    <NuxtLink to="/parties/new" class="fab" aria-label="Add party"><Plus :size="26" :stroke-width="2.4" /></NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { Factory, Plus } from '@lucide/vue'
const search = ref('')
const { format } = useCurrency()
const { data, pending } = await useFetch('/api/parties')

const filtered = computed(() => {
  const list = data.value ?? []
  if (!search.value) return list
  return list.filter((p: any) => p.name.toLowerCase().includes(search.value.toLowerCase()))
})
</script>

<style scoped>
.search-input {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  font-size: 16px;
  background: white;
  margin-bottom: 12px;
}
.list-card { padding: 4px 12px; }
.row-main { display: flex; flex-direction: column; gap: 2px; }
.row-main small { color: var(--ink-400); }
.amounts { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
.fab {
  position: fixed; right: 20px; bottom: calc(88px + env(safe-area-inset-bottom));
  width: 56px; height: 56px; border-radius: 50%; background: var(--accent); color: white;
  font-size: 28px; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(22,33,43,0.3); z-index: 15;
}
</style>
