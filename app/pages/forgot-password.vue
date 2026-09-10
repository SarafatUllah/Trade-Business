<template>
  <div class="auth-card">
    <div class="auth-icon"><KeyRound :size="26" :stroke-width="2" /></div>
    <h1>Reset your password</h1>
    <p class="subtitle">We'll send a reset link to your email</p>

    <form v-if="!sent" @submit.prevent="onSubmit">
      <div class="field">
        <label for="email">Email</label>
        <input
          id="email" v-model="email" type="email" required autocomplete="email"
          :class="{ invalid: touched && !isValidEmail }" @blur="touched = true"
        />
        <FieldMessage v-if="touched && !isValidEmail" type="error" message="Enter a valid email address" />
      </div>
      <button class="btn block" type="submit" :disabled="loading || !isValidEmail">
        <span>{{ loading ? 'Sending…' : 'Send reset link' }}</span>
        <ButtonSpinner v-if="loading" />
      </button>
    </form>

    <div v-else class="sent-state">
      <div class="sent-icon"><MailCheck :size="28" :stroke-width="2" /></div>
      <p>{{ message }}</p>
      <p class="hint">Didn't get it? Check that email/SMS delivery is configured for this app, or contact your admin.</p>
    </div>

    <p class="switch"><NuxtLink to="/login">← Back to sign in</NuxtLink></p>
  </div>
</template>

<script setup lang="ts">
import { KeyRound, MailCheck } from '@lucide/vue'
definePageMeta({ layout: 'auth' })

const email = ref('')
const touched = ref(false)
const loading = ref(false)
const sent = ref(false)
const message = ref('')

const isValidEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))

async function onSubmit() {
  touched.value = true
  if (!isValidEmail.value) return
  loading.value = true
  try {
    const res = await $fetch('/api/auth/forgot-password', { method: 'POST', body: { email: email.value } })
    message.value = res.message
    sent.value = true
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
.sent-state { text-align: center; padding: 12px 0; }
.sent-icon {
  width: 56px; height: 56px; border-radius: 999px; margin: 0 auto 14px;
  background: var(--receivable-100); color: var(--receivable-600);
  display: flex; align-items: center; justify-content: center;
}
.hint { font-size: 13px; color: var(--ink-400); margin-top: 10px; }
.switch { text-align: center; margin-top: 20px; font-size: 14px; color: var(--ink-400); }
.switch a { color: var(--focus); font-weight: 600; }
</style>
