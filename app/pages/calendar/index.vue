<template>
  <div>
    <div class="month-nav card">
      <button class="nav-btn" aria-label="Previous month" @click="shiftMonth(-1)"><ChevronLeft :size="20" /></button>
      <strong>{{ monthLabel }}</strong>
      <button class="nav-btn" aria-label="Next month" @click="shiftMonth(1)"><ChevronRight :size="20" /></button>
    </div>

    <SkeletonLoader v-if="pending" :rows="4" :row-height="70" />
    <template v-else>
      <EmptyState v-if="!data?.events?.length" :icon="CalendarCheck2" message="Nothing due this month" hint="Payments and collections will show up here as they're scheduled." />

      <div v-for="group in groupedByDay" :key="group.day" class="day-group">
        <div class="day-label">{{ group.label }}</div>
        <div class="card list-card">
          <div v-for="e in group.events" :key="e.type + e.id" class="activity-row">
            <div class="activity-icon" :class="e.type === 'PAY' ? 'payable' : 'receivable'">
              <component :is="e.type === 'PAY' ? ArrowUpFromLine : ArrowDownToLine" :size="16" :stroke-width="2.2" />
            </div>
            <div class="row-main">
              <strong>{{ e.type === 'PAY' ? 'Pay' : 'Receive' }} — {{ e.party?.name ?? 'Unknown' }}</strong>
              <small class="num" :class="e.type === 'PAY' ? 'payable-text' : 'receivable-text'">{{ format(e.amount) }}</small>
            </div>
            <NuxtLink :to="e.type === 'PAY' ? `/payables/${e.id}` : `/receivables/${e.id}`" class="btn secondary small">View</NuxtLink>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { CalendarCheck2, ChevronLeft, ChevronRight, ArrowUpFromLine, ArrowDownToLine } from '@lucide/vue'
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
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 14px 18px;
  width: 100%;
}
.month-nav strong { font-size: 16px; }
.nav-btn {
  width: 36px; height: 36px; border-radius: 999px;
  border: none; background: var(--paper-100); color: var(--ink-700);
  display: flex; align-items: center; justify-content: center;
}
.nav-btn:active { background: var(--accent); color: white; transform: scale(0.94); }

.day-group { margin-bottom: 14px; width: 100%; }
.day-label { font-size: 13px; font-weight: 700; color: var(--ink-400); margin-bottom: 6px; }
.list-card { width: 100%; padding: 6px 14px; }

.activity-row { display: flex; align-items: center; gap: 12px; padding: 12px 2px; border-bottom: 1px solid var(--line); width: 100%; }
.activity-row:last-child { border-bottom: none; }
.activity-icon {
  width: 36px; height: 36px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.activity-icon.receivable { background: var(--receivable-100); color: var(--receivable-600); }
.activity-icon.payable { background: var(--payable-100); color: var(--payable-600); }
.row-main { display: flex; flex-direction: column; gap: 2px; flex: 1 1 auto; min-width: 0; }
.row-main strong { font-size: 14px; }
.receivable-text { color: var(--receivable-600); font-weight: 700; }
.payable-text { color: var(--payable-600); font-weight: 700; }
.btn.small { padding: 6px 10px; min-height: auto; font-size: 12px; box-shadow: none; flex-shrink: 0; }
</style>
