<template>
  <div>
    <div class="month-nav">
      <button class="btn secondary" @click="shiftMonth(-1)">‹ Prev</button>
      <strong>{{ monthLabel }}</strong>
      <button class="btn secondary" @click="shiftMonth(1)">Next ›</button>
    </div>

    <div v-if="pending"><SkeletonLoader :rows="4" :row-height="70" /></div>
    <div v-else-if="!data?.events?.length" class="empty-state">Nothing due this month.</div>

    <div v-for="group in groupedByDay" :key="group.day" class="day-group">
      <div class="day-label">{{ group.label }}</div>
      <div class="card list-card">
        <div v-for="e in group.events" :key="e.type + e.id" class="ledger-row" :class="e.type === 'PAY' ? 'payable' : 'receivable'">
          <div class="row-main">
            <strong>{{ e.type === 'PAY' ? 'PAY' : 'RECEIVE' }} {{ format(e.amount) }}</strong>
            <small>{{ e.type === 'PAY' ? '→' : '←' }} {{ e.party?.name ?? 'Unknown' }}</small>
          </div>
          <NuxtLink :to="e.type === 'PAY' ? `/payables/${e.id}` : `/receivables/${e.id}`" class="btn secondary small">View</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { format } = useCurrency()
const cursor = ref(new Date())

const from = computed(() => new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1).toISOString())
const to = computed(() => new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 0, 23, 59, 59).toISOString())

const { data, pending, refresh } = await useFetch('/api/calendar', { query: computed(() => ({ from: from.value, to: to.value })) })

const monthLabel = computed(() => cursor.value.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }))

function shiftMonth(delta: number) {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1)
  refresh()
}

const groupedByDay = computed(() => {
  const events = data.value?.events ?? []
  const groups = new Map<string, any[]>()
  for (const e of events) {
    const key = new Date(e.date).toDateString()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(e)
  }
  return [...groups.entries()].map(([day, events]) => ({
    day,
    label: new Date(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
    events
  }))
})
</script>

<style scoped>
.month-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.day-group { margin-bottom: 14px; }
.day-label { font-size: 13px; font-weight: 700; color: var(--ink-400); margin-bottom: 6px; }
.list-card { padding: 4px 12px; }
.row-main { display: flex; flex-direction: column; gap: 2px; }
.row-main small { color: var(--ink-400); }
.btn.small { padding: 6px 10px; min-height: auto; font-size: 12px; }
</style>
