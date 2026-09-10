<template>
  <div>
    <div class="search-wrap">
      <Search :size="18" :stroke-width="2" class="search-icon" />
      <input v-model="search" type="search" placeholder="Search parties…" class="search-input" />
    </div>

    <div v-if="pending"><SkeletonLoader :rows="4" :row-height="70" /></div>
    <div v-else-if="!filtered.length"><EmptyState :icon="Factory" message="No parties yet" hint="Tap the + button to add a Mill or trading partner." /></div>

    <div class="card full-bleed list-card">
      <NuxtLink v-for="p in filtered" :key="p.id" :to="`/parties/${p.id}`" class="activity-row">
        <div class="activity-icon" :class="partyIconClass(p)"><Factory :size="17" :stroke-width="2.2" /></div>
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
  </div>
</template>

<script setup lang="ts">
import { Factory, Search } from '@lucide/vue'
const search = ref('')
const { format } = useCurrency()
const { data, pending } = await useFetch('/api/parties')

const filtered = computed(() => {
  const list = data.value ?? []
  if (!search.value) return list
  return list.filter((p: any) => p.name.toLowerCase().includes(search.value.toLowerCase()))
})

function partyIconClass(p: any) {
  if (p.outstandingPayable > 0 && p.outstandingReceivable > 0) return 'neutral'
  if (p.outstandingPayable > 0) return 'payable'
  if (p.outstandingReceivable > 0) return 'receivable'
  return 'neutral'
}
</script>

<style scoped>
.search-wrap { position: relative; margin-bottom: 12px; }
.search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--ink-400); }
.search-input {
  width: 100%;
  min-height: 46px;
  padding: 10px 12px 10px 42px;
  border: 1.5px solid var(--line);
  border-radius: 999px;
  font-size: 16px;
  background: white;
}
.search-input:focus { border-color: var(--focus); outline: none; box-shadow: 0 0 0 4px rgba(67, 97, 238, 0.12); }
.list-card { padding: 4px 10px; }
.activity-row { display: flex; align-items: center; gap: 12px; padding: 12px 4px; border-bottom: 1px solid var(--line); }
.activity-row:last-child { border-bottom: none; }
.activity-icon {
  width: 38px; height: 38px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.activity-icon.receivable { background: var(--receivable-100); color: var(--receivable-600); }
.activity-icon.payable { background: var(--payable-100); color: var(--payable-600); }
.activity-icon.neutral { background: var(--paper-100); color: var(--ink-400); }
.row-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.row-main small { color: var(--ink-400); }
.amounts { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
</style>
