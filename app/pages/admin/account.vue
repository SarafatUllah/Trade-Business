<template>
  <div>
    <div class="card full-bleed form-card">
      <h2 class="section-title">Profile</h2>
      <form @submit.prevent="onSaveProfile">
        <div class="field">
          <label>Name</label>
          <input v-model="profileForm.name" type="text" required />
        </div>
        <div class="field">
          <label>Email</label>
          <input v-model="profileForm.email" type="email" required />
        </div>
        <p v-if="profileError" class="error">{{ profileError }}</p>
        <p v-if="profileSuccess" class="success">{{ profileSuccess }}</p>
        <button class="btn block" type="submit" :disabled="savingProfile">
          <span>{{ savingProfile ? 'Saving…' : 'Save profile' }}</span>
          <ButtonSpinner v-if="savingProfile" />
        </button>
      </form>
    </div>

    <div class="card full-bleed form-card">
      <h2 class="section-title">Change password</h2>
      <form @submit.prevent="onChangePassword">
        <div class="field">
          <label>Current password</label>
          <input v-model="passwordForm.currentPassword" type="password" required autocomplete="current-password" />
        </div>
        <div class="field">
          <label>New password</label>
          <input v-model="passwordForm.newPassword" type="password" required minlength="8" autocomplete="new-password" />
          <FieldMessage v-if="passwordForm.newPassword && passwordForm.newPassword.length < 8" type="error" message="At least 8 characters" />
        </div>
        <p v-if="passwordError" class="error">{{ passwordError }}</p>
        <p v-if="passwordSuccess" class="success">{{ passwordSuccess }}</p>
        <button class="btn block" type="submit" :disabled="savingPassword">
          <span>{{ savingPassword ? 'Updating…' : 'Update password' }}</span>
          <ButtonSpinner v-if="savingPassword" />
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const adminStore = useAdminStore()

const profileForm = reactive({ name: adminStore.admin?.name || '', email: adminStore.admin?.email || '' })
const savingProfile = ref(false)
const profileError = ref('')
const profileSuccess = ref('')

async function onSaveProfile() {
  savingProfile.value = true
  profileError.value = ''
  profileSuccess.value = ''
  try {
    const updated = await $fetch('/api/admin/auth/profile', { method: 'PATCH', body: { ...profileForm } })
    if (adminStore.admin) {
      adminStore.admin.name = updated.name
      adminStore.admin.email = updated.email
    }
    profileSuccess.value = 'Profile updated.'
  } catch (e: any) {
    profileError.value = e?.data?.statusMessage || 'Could not update profile.'
  } finally {
    savingProfile.value = false
  }
}

const passwordForm = reactive({ currentPassword: '', newPassword: '' })
const savingPassword = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

async function onChangePassword() {
  savingPassword.value = true
  passwordError.value = ''
  passwordSuccess.value = ''
  try {
    await $fetch('/api/admin/auth/change-password', { method: 'POST', body: { ...passwordForm } })
    passwordSuccess.value = 'Password updated.'
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
  } catch (e: any) {
    passwordError.value = e?.data?.statusMessage || 'Could not update password.'
  } finally {
    savingPassword.value = false
  }
}
</script>

<style scoped>
.form-card { padding: 20px; margin-bottom: 16px; }
.section-title { font-size: 16px; margin: 0 0 16px; }
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.success { color: var(--receivable-600); font-size: 14px; margin: -6px 0 14px; }
</style>
