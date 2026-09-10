<template>
  <div>
    <button class="btn block" @click="showForm = !showForm">{{ showForm ? 'Cancel' : '+ Generate signup code' }}</button>

    <form v-if="showForm" class="card full-bleed new-code-form" @submit.prevent="onGenerate">
      <div class="field">
        <label>Type</label>
        <select v-model="form.type">
          <option value="PAID">Paid (after collecting payment)</option>
          <option value="FREE_TRIAL">Free trial</option>
        </select>
      </div>
      <div v-if="form.type === 'FREE_TRIAL'" class="field">
        <label>Trial length (days)<span class="req">*</span></label>
        <input v-model.number="form.trialDays" type="number" min="1" max="365" required />
      </div>
      <div class="field">
        <label>Notes (e.g. payment reference)</label>
        <textarea v-model="form.notes" rows="2" placeholder="bKash txn 8827..., ৳1200, 6 months" />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn block" type="submit" :disabled="generating">
        <span>{{ generating ? 'Generating…' : 'Generate code' }}</span>
        <ButtonSpinner v-if="generating" />
      </button>
    </form>

    <div v-if="generatedCode" class="generated-banner">
      <CircleCheck :size="18" :stroke-width="2.2" />
      <div>
        <strong>{{ generatedCode }}</strong>
        <small>Share this code with the customer to complete signup.</small>
      </div>
    </div>

    <div class="filters">
      <select v-model="statusFilter" @change="refresh">
        <option value="">All codes</option>
        <option value="unused">Unused</option>
        <option value="used">Used</option>
        <option value="revoked">Revoked</option>
      </select>
    </div>

    <div v-if="pending"><SkeletonLoader :rows="4" :row-height="70" /></div>
    <div v-else-if="!data?.length"><EmptyState :icon="Ticket" message="No codes yet" /></div>

    <div v-else class="card full-bleed list-card">
      <div v-for="c in data" :key="c.id" class="code-row">
        <div class="row-main">
          <strong>{{ c.code }}</strong>
          <small>{{ c.type === 'FREE_TRIAL' ? `${c.trialDays}-day trial` : 'Paid' }} · by {{ c.createdByAdmin }} · {{ formatDate(c.createdAt) }}</small>
          <small v-if="c.notes" class="notes">{{ c.notes }}</small>
          <small v-if="c.business" class="used-by">Used by: {{ c.business.name }}</small>
        </div>
        <div class="row-actions">
          <span class="pill" :class="statusPillClass(c)">{{ statusLabel(c) }}</span>
          <button v-if="!c.usedAt && !c.isRevoked" class="btn secondary small" @click="onRevoke(c)">Revoke</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Ticket, CircleCheck } from '@lucide/vue'
definePageMeta({ layout: 'admin' })

const showForm = ref(false)
const generating = ref(false)
const error = ref('')
const generatedCode = ref('')
const statusFilter = ref('')

const form = reactive({ type: 'PAID', trialDays: 30, notes: '' })

const { data, pending, refresh } = await useFetch('/api/admin/codes', {
  query: computed(() => ({ status: statusFilter.value || undefined }))
})

async function onGenerate() {
  generating.value = true
  error.value = ''
  try {
    const created = await $fetch('/api/admin/codes', {
      method: 'POST',
      body: {
        type: form.type,
        trialDays: form.type === 'FREE_TRIAL' ? form.trialDays : undefined,
        notes: form.notes || undefined
      }
    })
    generatedCode.value = created.code
    showForm.value = false
    form.notes = ''
    await refresh()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not generate a code.'
  } finally {
    generating.value = false
  }
}

async function onRevoke(c: any) {
  if (!confirm(`Revoke code ${c.code}? It can no longer be used to sign up.`)) return
  await $fetch(`/api/admin/codes/${c.id}/revoke`, { method: 'POST' })
  await refresh()
}

function statusLabel(c: any) {
  if (c.isRevoked) return 'Revoked'
  if (c.usedAt) return 'Used'
  return 'Unused'
}
function statusPillClass(c: any) {
  if (c.isRevoked) return 'overdue'
  if (c.usedAt) return 'neutral'
  return 'receivable'
}
function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.new-code-form { margin-top: 14px; }
.req { color: var(--overdue-600); margin-left: 2px; }
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.generated-banner {
  display: flex; align-items: center; gap: 12px;
  background: var(--receivable-100); color: var(--receivable-600);
  padding: 14px 16px; border-radius: var(--radius-md); margin: 16px 0;
}
.generated-banner strong { font-size: 16px; display: block; }
.generated-banner small { color: var(--ink-700); }
.filters { margin: 16px 0 12px; }
.filters select { width: 100%; min-height: 44px; padding: 10px; border: 1.5px solid var(--line); border-radius: var(--radius-sm); background: white; font-size: 14px; }
.list-card { padding: 4px 14px; }
.code-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.code-row:last-child { border-bottom: none; }
.row-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.row-main small { color: var(--ink-400); font-size: 12px; }
.notes { font-style: italic; }
.used-by { color: var(--receivable-600); font-weight: 600; }
.row-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
.btn.small { padding: 6px 10px; min-height: auto; font-size: 12px; box-shadow: none; }
</style>
