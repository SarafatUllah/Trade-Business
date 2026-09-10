<template>
  <div>
    <div v-if="pending"><SkeletonLoader :rows="3" :row-height="70" /></div>
    <template v-else-if="data">
      <div class="stat-grid">
        <div class="stat-tile card">
          <div class="stat-icon blue"><Users :size="18" :stroke-width="2.2" /></div>
          <small>Total accounts</small>
          <strong>{{ data.totalBusinesses }}</strong>
        </div>
        <div class="stat-tile card">
          <div class="stat-icon teal"><CircleCheck :size="18" :stroke-width="2.2" /></div>
          <small>Active</small>
          <strong>{{ data.activeBusinesses }}</strong>
        </div>
        <div class="stat-tile card">
          <div class="stat-icon amber"><CircleOff :size="18" :stroke-width="2.2" /></div>
          <small>Deactivated</small>
          <strong>{{ data.deactivatedBusinesses }}</strong>
        </div>
        <div class="stat-tile card">
          <div class="stat-icon blue"><Clock :size="18" :stroke-width="2.2" /></div>
          <small>On free trial</small>
          <strong>{{ data.trialBusinesses }}</strong>
        </div>
        <div class="stat-tile card">
          <div class="stat-icon teal"><Ticket :size="18" :stroke-width="2.2" /></div>
          <small>Signup codes</small>
          <strong>{{ data.totalCodes }}</strong>
        </div>
        <div class="stat-tile card">
          <div class="stat-icon amber"><TicketX :size="18" :stroke-width="2.2" /></div>
          <small>Unused codes</small>
          <strong>{{ data.unusedCodes }}</strong>
        </div>
      </div>

      <h2 class="section-title">Recent signups</h2>
      <div class="card full-bleed list-card">
        <EmptyState v-if="!data.recentBusinesses.length" :icon="Users" message="No accounts yet" />
        <NuxtLink v-for="b in data.recentBusinesses" :key="b.id" :to="`/admin/users/${b.id}`" class="activity-row">
          <div class="activity-icon" :class="b.accountStatus === 'ACTIVE' ? 'teal' : 'amber'"><Building2 :size="16" :stroke-width="2.2" /></div>
          <div class="row-main">
            <strong>{{ b.name }}</strong>
            <small>{{ b.owner?.email }} · {{ formatDate(b.createdAt) }}</small>
          </div>
          <span class="pill" :class="b.accountStatus === 'ACTIVE' ? 'receivable' : 'overdue'">{{ b.accountStatus }}</span>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Users, CircleCheck, CircleOff, Clock, Ticket, TicketX, Building2 } from '@lucide/vue'
definePageMeta({ layout: 'admin' })

const { data, pending } = await useFetch('/api/admin/dashboard')
function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
.stat-tile { display: flex; flex-direction: column; gap: 4px; }
.stat-icon { width: 34px; height: 34px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
.stat-icon.blue { background: rgba(67, 97, 238, 0.12); color: var(--accent); }
.stat-icon.teal { background: var(--receivable-100); color: var(--receivable-600); }
.stat-icon.amber { background: var(--payable-100); color: var(--payable-600); }
.stat-tile small { color: var(--ink-400); font-size: 12px; font-weight: 600; }
.stat-tile strong { font-size: 22px; }
.section-title { font-size: 15px; margin: 0 0 8px; color: var(--ink-700); }
.list-card { padding: 4px 14px; }
.activity-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.activity-row:last-child { border-bottom: none; }
.activity-icon { width: 36px; height: 36px; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.activity-icon.teal { background: var(--receivable-100); color: var(--receivable-600); }
.activity-icon.amber { background: var(--payable-100); color: var(--payable-600); }
.row-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.row-main small { color: var(--ink-400); }
</style>
