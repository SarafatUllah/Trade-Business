<template>
  <div class="auth-card">
    <div class="auth-icon"><BookText :size="26" :stroke-width="2" /></div>
    <h1>Trade Business</h1>
    <p class="subtitle">Sign in to your ledger</p>

    <form @submit.prevent="onSubmit">
      <div class="field">
        <label for="email">Email</label>
        <input
          id="email" v-model="email" type="email" required autocomplete="email"
          :class="{ invalid: touchedEmail && !isValidEmail }" @blur="touchedEmail = true"
        />
        <FieldMessage v-if="touchedEmail && !isValidEmail" type="error" message="Enter a valid email address" />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input
          id="password" v-model="password" type="password" required autocomplete="current-password"
          :class="{ invalid: touchedPassword && !password }" @blur="touchedPassword = true"
        />
        <FieldMessage v-if="touchedPassword && !password" type="error" message="Password is required" />
      </div>

      <div class="row-between">
        <label class="checkbox-row">
          <input v-model="remember" type="checkbox" />
          <span>Remember me</span>
        </label>
        <NuxtLink to="/forgot-password" class="forgot-link">Forgot password?</NuxtLink>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn block" type="submit" :disabled="loading"><span>{{ loading ? 'Signing in…' : 'Sign in' }}</span><ButtonSpinner v-if="loading" /></button>
    </form>

    <p class="switch">New here? <NuxtLink to="/register">Create a business account</NuxtLink></p>
  </div>
</template>

<script setup lang="ts">
import { BookText } from '@lucide/vue'
definePageMeta({ layout: 'auth' })

const email = ref('')
const password = ref('')
const remember = ref(true)
const touchedEmail = ref(false)
const touchedPassword = ref(false)
const loading = ref(false)
const error = ref('')
const auth = useAuthStore()
const router = useRouter()

const isValidEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))

async function onSubmit() {
  touchedEmail.value = true
  touchedPassword.value = true
  if (!isValidEmail.value || !password.value) return
  loading.value = true
  error.value = ''
  try {
    await auth.login(email.value, password.value, remember.value)
    router.push('/')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not sign in. Check your email and password.'
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
h1 { font-size: 26px; margin-bottom: 4px; }
.subtitle { color: var(--ink-400); margin: 0 0 24px; }
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.row-between { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--ink-700); }
.checkbox-row input { width: 18px; height: 18px; }
.forgot-link { font-size: 14px; color: var(--focus); font-weight: 600; }
.switch { text-align: center; margin-top: 20px; font-size: 14px; color: var(--ink-400); }
.switch a { color: var(--focus); font-weight: 600; }
</style>
