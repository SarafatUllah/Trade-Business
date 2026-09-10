<template>
  <div v-if="pending"><SkeletonLoader :rows="4" :row-height="90" /></div>
  <div v-else-if="data">
    <!-- Net position: the one number that matters most, given top billing -->
    <div class="net-hero" :class="data.netPosition >= 0 ? 'positive' : 'negative'">
      <div class="net-hero-icon">
        <component :is="data.netPosition >= 0 ? TrendingUp : TrendingDown" :size="22" :stroke-width="2.2" />
      </div>
      <div class="net-hero-copy">
        <small>Net position</small>
        <strong class="num">
          {{ data.netPosition >= 0 ? '+' : '' }}{{ format(data.netPosition) }}
        </strong>
        <span class="net-hero-tag">{{ data.netPosition >= 0 ? 'Net receivable' : 'Net payable' }}</span>
      </div>
    </div>

    <section class="hero-grid">
      <div class="hero-tile receivable">
        <div class="hero-tile-icon"><HandCoins :size="18" :stroke-width="2.2" /></div>
        <small>You will receive</small>
        <strong class="num">{{ format(data.totalReceivable) }}</strong>
      </div>
      <div class="hero-tile payable">
        <div class="hero-tile-icon"><Wallet :size="18" :stroke-width="2.2" /></div>
        <small>You have to pay</small>
        <strong class="num">{{ format(data.totalPayable) }}</strong>
      </div>
    </section>

    <div class="stat-row">
      <div class="stat card">
        <div class="stat-icon"><CalendarClock :size="16" :stroke-width="2.2" /></div>
        <small>Expected today</small>
        <strong class="num">{{ format(data.amountExpectedToday) }}</strong>
      </div>
      <div class="stat card">
        <div class="stat-icon"><CalendarClock :size="16" :stroke-width="2.2" /></div>
        <small>To pay today</small>
        <strong class="num">{{ format(data.amountToPayToday) }}</strong>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat card" :class="{ alert: data.overdueReceivable > 0 }">
        <div class="stat-icon"><AlertTriangle :size="16" :stroke-width="2.2" /></div>
        <small>Overdue receivable</small>
        <strong class="num" :class="{ overdue: data.overdueReceivable > 0 }">{{ format(data.overdueReceivable) }}</strong>
      </div>
      <div class="stat card" :class="{ alert: data.overduePayable > 0 }">
        <div class="stat-icon"><AlertTriangle :size="16" :stroke-width="2.2" /></div>
        <small>Overdue payable</small>
        <strong class="num" :class="{ overdue: data.overduePayable > 0 }">{{ format(data.overduePayable) }}</strong>
      </div>
    </div>

    <div class="section-header">
      <ArrowDownToLine :size="16" :stroke-width="2.2" />
      <h2 class="section-title">Upcoming collections</h2>
    </div>
    <div class="card list-card">
      <EmptyState v-if="!data.upcomingCollections.length" :icon="CalendarCheck2" message="Nothing expected soon" />
      <div v-for="e in data.upcomingCollections" :key="e.id" class="activity-row">
        <div class="activity-icon receivable"><ArrowDownToLine :size="16" :stroke-width="2.2" /></div>
        <div class="row-main">
          <strong>{{ e.party?.name ?? 'Unknown party' }}</strong>
          <small>{{ formatDate(e.expectedDate) }}</small>
        </div>
        <span class="num receivable-text">{{ format(e.amount) }}</span>
      </div>
    </div>

    <div class="section-header">
      <ArrowUpFromLine :size="16" :stroke-width="2.2" />
      <h2 class="section-title">Upcoming payments</h2>
    </div>
    <div class="card list-card">
      <EmptyState v-if="!data.upcomingPayments.length" :icon="CalendarCheck2" message="Nothing due soon" />
      <div v-for="e in data.upcomingPayments" :key="e.id" class="activity-row">
        <div class="activity-icon payable"><ArrowUpFromLine :size="16" :stroke-width="2.2" /></div>
        <div class="row-main">
          <strong>{{ e.party?.name ?? 'Unknown party' }}</strong>
          <small>{{ formatDate(e.dueDate) }}</small>
        </div>
        <span class="num payable-text">{{ format(e.amount) }}</span>
      </div>
    </div>

    <div class="section-header">
      <History :size="16" :stroke-width="2.2" />
      <h2 class="section-title">Recent activity</h2>
    </div>
    <div class="card list-card">
      <EmptyState v-if="!data.recentTransactions.length" :icon="BookOpen" message="No transactions yet" />
      <div v-for="t in data.recentTransactions" :key="t.id" class="activity-row">
        <div class="activity-icon neutral"><FileText :size="16" :stroke-width="2.2" /></div>
        <div class="row-main">
          <strong>{{ t.party?.name ?? 'General entry' }}</strong>
          <small>{{ t.description || 'No description' }}</small>
        </div>
        <span class="num muted">{{ formatDate(t.date) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  TrendingUp, TrendingDown, HandCoins, Wallet, CalendarClock, AlertTriangle,
  ArrowDownToLine, ArrowUpFromLine, History, CalendarCheck2, BookOpen, FileText
} from '@lucide/vue'
const { format } = useCurrency()
function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
const { data, pending } = await useFetch('/api/dashboard')
</script>

<style scoped>
.net-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
  border-radius: var(--radius-lg);
  margin-bottom: 14px;
  color: white;
  background: linear-gradient(135deg, #2541D6, #4361EE 60%, #5B7CFA);
  box-shadow: 0 12px 28px -10px rgba(67, 97, 238, 0.55);
}
.net-hero.negative { background: linear-gradient(135deg, #B45309, #D97706 60%, #F0930C); box-shadow: 0 12px 28px -10px rgba(217, 119, 6, 0.5); }
.net-hero-icon {
  width: 44px; height: 44px; border-radius: 999px;
  background: rgba(255,255,255,0.18);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.net-hero-copy { display: flex; flex-direction: column; gap: 2px; }
.net-hero-copy small { opacity: 0.85; font-size: 12px; font-weight: 600; }
.net-hero-copy strong { font-size: 26px; }
.net-hero-tag { font-size: 12px; opacity: 0.85; font-weight: 600; }

.hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.hero-tile {
  border-radius: var(--radius-md);
  padding: 16px;
  color: white;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hero-tile.receivable { background: var(--receivable-600); }
.hero-tile.payable { background: var(--payable-600); }
.hero-tile-icon {
  width: 30px; height: 30px; border-radius: 999px;
  background: rgba(255,255,255,0.22);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 2px;
}
.hero-tile small { opacity: 0.9; font-size: 12px; font-weight: 600; }
.hero-tile strong { font-size: 21px; }

.stat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.stat { display: flex; flex-direction: column; gap: 4px; position: relative; }
.stat.alert { border-color: var(--overdue-600); background: var(--overdue-100); }
.stat-icon { color: var(--ink-400); margin-bottom: 2px; }
.stat small { color: var(--ink-400); font-size: 12px; font-weight: 600; }
.stat strong { font-size: 17px; }
.stat strong.overdue { color: var(--overdue-600); }

.section-header { display: flex; align-items: center; gap: 6px; margin: 20px 0 8px; color: var(--ink-700); }
.section-title { font-size: 15px; color: var(--ink-700); }
.list-card { padding: 6px 10px; }

.activity-row { display: flex; align-items: center; gap: 12px; padding: 10px 4px; border-bottom: 1px solid var(--line); }
.activity-row:last-child { border-bottom: none; }
.activity-icon {
  width: 36px; height: 36px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.activity-icon.receivable { background: var(--receivable-100); color: var(--receivable-600); }
.activity-icon.payable { background: var(--payable-100); color: var(--payable-600); }
.activity-icon.neutral { background: var(--paper-100); color: var(--ink-400); }

.row-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.row-main strong { font-size: 14px; }
.row-main small { color: var(--ink-400); font-size: 12px; }
.receivable-text { color: var(--receivable-600); font-weight: 700; }
.payable-text { color: var(--payable-600); font-weight: 700; }
.muted { color: var(--ink-400); font-weight: 500; font-size: 13px; }

</style>
