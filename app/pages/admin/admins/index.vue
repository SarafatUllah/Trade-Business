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
        <div class="admin-row-top" @click="a.role === 'SUB_ADMIN' ? toggleEdit(a) : null">
          <div class="row-main">
            <strong>{{ a.name }} <span v-if="a.role === 'SUPER_ADMIN'" class="pill neutral">SUPER</span></strong>
            <small>{{ a.email }}</small>
            <div v-if="a.role === 'SUB_ADMIN'" class="perm-chips">
              <span v-if="a.canViewUsers" class="perm-chip">View</span>
              <span v-if="a.canManageUserStatus" class="perm-chip">Activate/Deactivate</span>
              <span v-if="a.canDeleteUsers" class="perm-chip">Delete</span>
              <span v-if="a.canGenerateCodes" class="perm-chip">Codes</span>
              <span v-if="a.canManageSubAdmins" class="perm-chip">Sub-Admins</span>
              <span v-if="!a.isActive" class="perm-chip inactive">Deactivated</span>
            </div>
          </div>
          <ChevronRight v-if="a.role === 'SUB_ADMIN'" :size="18" :stroke-width="2.2" class="chevron" :class="{ open: editingId === a.id }" />
        </div>

        <div v-if="editingId === a.id" class="edit-panel">
          <div class="field">
            <label>Name</label>
            <input v-model="editForm.name" type="text" />
          </div>
          <div class="field">
            <label>Email</label>
            <input v-model="editForm.email" type="email" />
          </div>
          <div class="field">
            <label>Permissions</label>
            <label class="checkbox-row"><input v-model="editForm.canViewUsers" type="checkbox" /> <span>View users</span></label>
            <label class="checkbox-row"><input v-model="editForm.canManageUserStatus" type="checkbox" /> <span>Activate/deactivate accounts</span></label>
            <label class="checkbox-row"><input v-model="editForm.canDeleteUsers" type="checkbox" /> <span>Delete accounts</span></label>
            <label class="checkbox-row"><input v-model="editForm.canGenerateCodes" type="checkbox" /> <span>Generate signup codes</span></label>
            <label class="checkbox-row"><input v-model="editForm.canManageSubAdmins" type="checkbox" /> <span>Manage other sub-admins</span></label>
          </div>
          <p v-if="editError" class="error">{{ editError }}</p>
          <div class="edit-actions">
            <button class="btn secondary" type="button" @click="editingId = null">Cancel</button>
            <button class="btn" type="button" :disabled="savingEdit" @click="onSaveEdit(a)">Save</button>
          </div>
          <div class="edit-actions">
            <button class="btn secondary" type="button" @click="toggleActive(a)">{{ a.isActive ? 'Deactivate' : 'Activate' }}</button>
            <button class="btn secondary" type="button" @click="onResetPassword(a)">Reset password</button>
          </div>
          <button class="btn danger block" type="button" @click="onDelete(a)">Delete sub-admin</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Users, ChevronRight } from '@lucide/vue'
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

const editingId = ref<string | null>(null)
const editForm = reactive({
  name: '', email: '',
  canViewUsers: false, canManageUserStatus: false, canDeleteUsers: false,
  canGenerateCodes: false, canManageSubAdmins: false
})
const savingEdit = ref(false)
const editError = ref('')

function toggleEdit(a: any) {
  if (editingId.value === a.id) { editingId.value = null; return }
  editingId.value = a.id
  editError.value = ''
  editForm.name = a.name
  editForm.email = a.email
  editForm.canViewUsers = a.canViewUsers
  editForm.canManageUserStatus = a.canManageUserStatus
  editForm.canDeleteUsers = a.canDeleteUsers
  editForm.canGenerateCodes = a.canGenerateCodes
  editForm.canManageSubAdmins = a.canManageSubAdmins
}

async function onSaveEdit(a: any) {
  savingEdit.value = true
  editError.value = ''
  try {
    await $fetch(`/api/admin/admins/${a.id}`, { method: 'PATCH', body: { ...editForm } })
    editingId.value = null
    await refresh()
  } catch (e: any) {
    editError.value = e?.data?.statusMessage || 'Could not save changes.'
  } finally {
    savingEdit.value = false
  }
}

async function toggleActive(a: any) {
  if (!confirm(`${a.isActive ? 'Deactivate' : 'Activate'} sub-admin "${a.name}"?`)) return
  await $fetch(`/api/admin/admins/${a.id}`, { method: 'PATCH', body: { isActive: !a.isActive } })
  await refresh()
}

async function onResetPassword(a: any) {
  const newPassword = prompt(`New password for ${a.name} (min 8 characters):`)
  if (!newPassword) return
  if (newPassword.length < 8) { alert('Password must be at least 8 characters.'); return }
  try {
    await $fetch(`/api/admin/admins/${a.id}/reset-password`, { method: 'POST', body: { newPassword } })
    alert('Password updated. Share the new password with them securely.')
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Could not reset password.')
  }
}

async function onDelete(a: any) {
  if (!confirm(`Permanently delete sub-admin "${a.name}"? This cannot be undone.`)) return
  try {
    await $fetch(`/api/admin/admins/${a.id}`, { method: 'DELETE' })
    editingId.value = null
    await refresh()
  } catch (e: any) {
    alert(e?.data?.statusMessage || 'Could not delete this sub-admin.')
  }
}
</script>

<style scoped>
.new-form { margin-top: 14px; }
.req { color: var(--overdue-600); margin-left: 2px; }
.checkbox-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 14px; font-weight: 400; }
.checkbox-row input { width: 18px; height: 18px; }
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.list-card { padding: 4px 14px; margin-top: 16px; }
.admin-row { border-bottom: 1px solid var(--line); }
.admin-row:last-child { border-bottom: none; }
.admin-row-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 0; cursor: pointer; }
.row-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.row-main small { color: var(--ink-400); }
.perm-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.perm-chip { background: var(--paper-100); color: var(--ink-700); padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.perm-chip.inactive { background: var(--overdue-100); color: var(--overdue-600); }
.chevron { color: var(--ink-400); flex-shrink: 0; transition: transform 0.2s; }
.chevron.open { transform: rotate(90deg); }
.edit-panel { padding: 0 0 16px; animation: expand 0.15s ease-out; }
@keyframes expand { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.edit-actions { display: flex; gap: 8px; margin-bottom: 10px; }
.edit-actions .btn { flex: 1; }
.btn.danger { background: var(--overdue-600); }
</style>
