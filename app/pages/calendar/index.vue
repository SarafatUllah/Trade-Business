<template>
  <div>
    <div class="month-nav card full-bleed">
      <button class="nav-btn" aria-label="Previous month" @click="shiftMonth(-1)"><ChevronLeft :size="20" /></button>
      <strong>{{ monthLabel }}</strong>
      <button class="nav-btn" aria-label="Next month" @click="shiftMonth(1)"><ChevronRight :size="20" /></button>
    </div>

    <SkeletonLoader v-if="pending" :rows="4" :row-height="70" />
    <template v-else>
      <EmptyState v-if="!events.length" :icon="CalendarCheck2" message="Nothing due this month" hint="Payments and collections will show up here as they're scheduled." />

      <div v-for="group in groupedByDay" :key="group.day" class="day-group">
        <div class="day-label">{{ group.label }}</div>
        <div class="card full-bleed list-card">
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

// Manual load control (not useFetch's auto-watched query) — this
// guarantees `pending` is true for the entire duration of every
// Next/Prev click, with no ambiguity about whether an internal
// dedupe/watch behavior might skip or race the loading state.
const events = ref<any[]>([])
const pending = ref(true)

async function loadMonth() {
  pending.value = true
  const from = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1).toISOString()
  const to = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 0, 23, 59, 59).toISOString()
  try {
    const res = await $fetch('/api/calendar', { query: { from, to } })
    events.value = res.events
  } catch (e: any) {
    if (e?.response?.status === 401) return navigateTo('/login')
    throw e
  } finally {
    pending.value = false
  }
}

await loadMonth()

const monthLabel = computed(() => cursor.value.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }))

function shiftMonth(delta: number) {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1)
  loadMonth()
}

const groupedByDay = computed(() => {
  const groups = new Map<string, any[]>()
  for (const e of events.value) {
    const key = new Date(e.date).toDateString()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(e)
  }
  return [...groups.entries()].map(([day, dayEvents]) => ({
    day,
    label: new Date(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
    events: dayEvents
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
}
.month-nav strong { font-size: 16px; }
.nav-btn {
  width: 36px; height: 36px; border-radius: 999px;
  border: none; background: var(--paper-100); color: var(--ink-700);
  display: flex; align-items: center; justify-content: center;
}
.nav-btn:active { background: var(--accent); color: white; transform: scale(0.94); }

.day-group { margin-bottom: 14px; }
.day-label { font-size: 13px; font-weight: 700; color: var(--ink-400); margin: 0 16px 6px; }
.list-card { padding: 6px 18px; }

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
