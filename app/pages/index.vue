<template>
  <div v-if="pending"><SkeletonLoader :rows="4" :row-height="90" /></div>
  <div v-else-if="data">
    <section class="hero-grid">
      <div class="hero-tile receivable">
        <small>You will receive</small>
        <strong class="num">{{ format(data.totalReceivable) }}</strong>
      </div>
      <div class="hero-tile payable">
        <small>You have to pay</small>
        <strong class="num">{{ format(data.totalPayable) }}</strong>
      </div>
    </section>

    <div class="net card">
      <small>Net position</small>
      <strong class="num" :class="data.netPosition >= 0 ? 'positive' : 'negative'">
        {{ data.netPosition >= 0 ? '+' : '' }}{{ format(data.netPosition) }}
        {{ data.netPosition >= 0 ? 'receivable' : 'payable' }}
      </strong>
    </div>

    <div class="stat-row">
      <div class="stat card">
        <small>Expected today</small>
        <strong class="num">{{ format(data.amountExpectedToday) }}</strong>
      </div>
      <div class="stat card">
        <small>To pay today</small>
        <strong class="num">{{ format(data.amountToPayToday) }}</strong>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat card">
        <small>Overdue receivable</small>
        <strong class="num overdue">{{ format(data.overdueReceivable) }}</strong>
      </div>
      <div class="stat card">
        <small>Overdue payable</small>
        <strong class="num overdue">{{ format(data.overduePayable) }}</strong>
      </div>
    </div>

    <h2 class="section-title">Upcoming collections</h2>
    <div class="card list-card">
      <p v-if="!data.upcomingCollections.length" class="empty-state">Nothing expected soon.</p>
      <div v-for="e in data.upcomingCollections" :key="e.id" class="ledger-row receivable">
        <div class="row-main">
          <strong>{{ e.party?.name ?? 'Unknown party' }}</strong>
          <small>{{ formatDate(e.expectedDate) }}</small>
        </div>
        <span class="num receivable-text">{{ format(e.amount) }}</span>
      </div>
    </div>

    <h2 class="section-title">Upcoming payments</h2>
    <div class="card list-card">
      <p v-if="!data.upcomingPayments.length" class="empty-state">Nothing due soon.</p>
      <div v-for="e in data.upcomingPayments" :key="e.id" class="ledger-row payable">
        <div class="row-main">
          <strong>{{ e.party?.name ?? 'Unknown party' }}</strong>
          <small>{{ formatDate(e.dueDate) }}</small>
        </div>
        <span class="num payable-text">{{ format(e.amount) }}</span>
      </div>
    </div>

    <h2 class="section-title">Recent activity</h2>
    <div class="card list-card">
      <p v-if="!data.recentTransactions.length" class="empty-state">No transactions yet.</p>
      <div v-for="t in data.recentTransactions" :key="t.id" class="ledger-row">
        <div class="row-main">
          <strong>{{ t.party?.name ?? 'General entry' }}</strong>
          <small>{{ t.description || 'No description' }}</small>
        </div>
        <span class="num">{{ formatDate(t.date) }}</span>
      </div>
    </div>

    <NuxtLink to="/transactions/new" class="fab" aria-label="Add transaction"><Plus :size="26" :stroke-width="2.4" /></NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { Plus } from '@lucide/vue'
const { format } = useCurrency()
function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
const { data, pending } = await useFetch('/api/dashboard')
</script>

<style scoped>
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
.hero-tile small { opacity: 0.85; font-size: 12px; font-weight: 600; }
.hero-tile strong { font-size: 22px; }

.net { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.net small { color: var(--ink-400); font-size: 12px; font-weight: 600; }
.net strong { font-size: 20px; }
.net strong.positive { color: var(--receivable-600); }
.net strong.negative { color: var(--payable-600); }

.stat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.stat { display: flex; flex-direction: column; gap: 4px; }
.stat small { color: var(--ink-400); font-size: 12px; font-weight: 600; }
.stat strong { font-size: 17px; }
.stat strong.overdue { color: var(--overdue-600); }

.section-title { font-size: 15px; margin: 18px 0 8px; color: var(--ink-700); }
.list-card { padding: 4px 12px; }
.row-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.row-main small { color: var(--ink-400); }
.receivable-text { color: var(--receivable-600); font-weight: 700; }
.payable-text { color: var(--payable-600); font-weight: 700; }

.fab {
  position: fixed;
  right: 20px;
  bottom: calc(88px + env(safe-area-inset-bottom));
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--ink-900);
  color: white;
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(22,33,43,0.3);
  z-index: 15;
}
</style>
