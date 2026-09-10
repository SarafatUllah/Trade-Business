<template>
  <div>
    <button class="btn block" @click="showForm = !showForm">{{ showForm ? 'Cancel' : '+ Add sub-admin' }}</button>

    <form v-if="showForm" class="card full-bleed new-form" @submit.prevent="onCreate">
      <div class="field">
        <label>Name<span class="req">*</span></label>
        <input v-model="form.name" type="text" required />
      </div>
      <div class="field">
        <label>Email<span class="req">*</span></label>
        <input v-model="form.email" type="email" required />
      </div>
      <div class="field">
        <label>Password<span class="req">*</span></label>
        <input v-model="form.password" type="password" required minlength="8" />
      </div>
      <div class="field">
        <label>Permissions</label>
        <label class="checkbox-row"><input v-model="form.canViewUsers" type="checkbox" /> <span>View users</span></label>
        <label class="checkbox-row"><input v-model="form.canManageUserStatus" type="checkbox" /> <span>Activate/deactivate accounts</span></label>
        <label class="checkbox-row"><input v-model="form.canDeleteUsers" type="checkbox" /> <span>Delete accounts</span></label>
        <label class="checkbox-row"><input v-model="form.canGenerateCodes" type="checkbox" /> <span>Generate signup codes</span></label>
        <label class="checkbox-row"><input v-model="form.canManageSubAdmins" type="checkbox" /> <span>Manage other sub-admins</span></label>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn block" type="submit" :disabled="saving">
        <span>{{ saving ? 'Creating…' : 'Create sub-admin' }}</span>
        <ButtonSpinner v-if="saving" />
      </button>
    </form>

    <div v-if="pending"><SkeletonLoader :rows="3" :row-height="90" /></div>
    <div v-else-if="!data?.length"><EmptyState :icon="Users" message="No sub-admins yet" /></div>

    <div v-else class="card full-bleed list-card">
      <div v-for="a in data" :key="a.id" class="admin-row">
        <div class="row-main">
          <strong>{{ a.name }} <span v-if="a.role === 'SUPER_ADMIN'" class="pill neutral">SUPER</span></strong>
          <small>{{ a.email }}</small>
          <div v-if="a.role === 'SUB_ADMIN'" class="perm-chips">
            <span v-if="a.canViewUsers" class="perm-chip">View</span>
            <span v-if="a.canManageUserStatus" class="perm-chip">Activate/Deactivate</span>
            <span v-if="a.canDeleteUsers" class="perm-chip">Delete</span>
            <span v-if="a.canGenerateCodes" class="perm-chip">Codes</span>
            <span v-if="a.canManageSubAdmins" class="perm-chip">Sub-Admins</span>
          </div>
        </div>
        <button v-if="a.role === 'SUB_ADMIN'" class="btn secondary small" @click="toggleActive(a)">
          {{ a.isActive ? 'Deactivate' : 'Activate' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Users } from '@lucide/vue'
definePageMeta({ layout: 'admin' })

const showForm = ref(false)
const saving = ref(false)
const error = ref('')

const form = reactive({
  name: '', email: '', password: '',
  canViewUsers: true, canManageUserStatus: false, canDeleteUsers: false,
  canGenerateCodes: false, canManageSubAdmins: false
})

const { data, pending, refresh } = await useFetch('/api/admin/admins')

async function onCreate() {
  saving.value = true
  error.value = ''
  try {
    await $fetch('/api/admin/admins', { method: 'POST', body: { ...form } })
    Object.assign(form, { name: '', email: '', password: '', canViewUsers: true, canManageUserStatus: false, canDeleteUsers: false, canGenerateCodes: false, canManageSubAdmins: false })
    showForm.value = false
    await refresh()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not create this sub-admin.'
  } finally {
    saving.value = false
  }
}

async function toggleActive(a: any) {
  if (!confirm(`${a.isActive ? 'Deactivate' : 'Activate'} sub-admin "${a.name}"?`)) return
  await $fetch(`/api/admin/admins/${a.id}`, { method: 'PATCH', body: { isActive: !a.isActive } })
  await refresh()
}
</script>

<style scoped>
.new-form { margin-top: 14px; }
.req { color: var(--overdue-600); margin-left: 2px; }
.checkbox-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 14px; font-weight: 400; }
.checkbox-row input { width: 18px; height: 18px; }
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.list-card { padding: 4px 14px; margin-top: 16px; }
.admin-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 0; border-bottom: 1px solid var(--line); }
.admin-row:last-child { border-bottom: none; }
.row-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.row-main small { color: var(--ink-400); }
.perm-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.perm-chip { background: var(--paper-100); color: var(--ink-700); padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.btn.small { padding: 6px 10px; min-height: auto; font-size: 12px; box-shadow: none; flex-shrink: 0; }
</style>
