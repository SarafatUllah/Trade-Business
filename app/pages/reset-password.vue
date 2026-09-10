<template>
  <div class="auth-card">
    <div class="auth-icon"><LockKeyhole :size="26" :stroke-width="2" /></div>
    <h1>Set a new password</h1>
    <p class="subtitle">Choose a new password for your account</p>

    <form v-if="!done" @submit.prevent="onSubmit">
      <div class="field">
        <label for="password">New password</label>
        <input
          id="password" v-model="password" type="password" required autocomplete="new-password"
          :class="{ invalid: touched && !isValidPassword }" @blur="touched = true"
        />
        <FieldMessage v-if="touched && !isValidPassword" type="error" message="At least 8 characters" />
        <FieldMessage v-else-if="touched && isValidPassword" type="valid" message="Looks good" />
      </div>
      <div class="field">
        <label for="confirm">Confirm password</label>
        <input
          id="confirm" v-model="confirm" type="password" required autocomplete="new-password"
          :class="{ invalid: confirmTouched && !passwordsMatch }" @blur="confirmTouched = true"
        />
        <FieldMessage v-if="confirmTouched && !passwordsMatch" type="error" message="Passwords don't match" />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn block" type="submit" :disabled="loading || !isValidPassword || !passwordsMatch">
        <span>{{ loading ? 'Saving…' : 'Save new password' }}</span>
        <ButtonSpinner v-if="loading" />
      </button>
    </form>

    <div v-else class="sent-state">
      <div class="sent-icon"><CircleCheck :size="28" :stroke-width="2" /></div>
      <p>Password updated. You can sign in now.</p>
      <NuxtLink to="/login" class="btn block" style="margin-top:16px;">Go to sign in</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LockKeyhole, CircleCheck } from '@lucide/vue'
definePageMeta({ layout: 'auth' })

const route = useRoute()
const token = (route.query.token as string) || ''

const password = ref('')
const confirm = ref('')
const touched = ref(false)
const confirmTouched = ref(false)
const loading = ref(false)
const done = ref(false)
const error = ref('')

const isValidPassword = computed(() => password.value.length >= 8)
const passwordsMatch = computed(() => password.value === confirm.value && password.value.length > 0)

async function onSubmit() {
  touched.value = true
  confirmTouched.value = true
  if (!isValidPassword.value || !passwordsMatch.value) return
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/reset-password', { method: 'POST', body: { token, newPassword: password.value } })
    done.value = true
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not reset your password. The link may have expired.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-card { width: 100%; max-width: 380px; }
.auth-icon {
  width: 52px; height: 52px; border-radius: 999px;
  background: var(--paper-100); color: var(--accent);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 14px;
}
h1 { font-size: 24px; margin-bottom: 4px; }
.subtitle { color: var(--ink-400); margin: 0 0 24px; }
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.sent-state { text-align: center; padding: 12px 0; }
.sent-icon {
  width: 56px; height: 56px; border-radius: 999px; margin: 0 auto 14px;
  background: var(--receivable-100); color: var(--receivable-600);
  display: flex; align-items: center; justify-content: center;
}
</style>
