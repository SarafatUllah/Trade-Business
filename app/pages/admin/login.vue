<template>
  <div class="auth-card">
    <div class="auth-icon"><ShieldCheck :size="26" :stroke-width="2" /></div>
    <h1>Admin Panel</h1>
    <p class="subtitle">Sign in to manage accounts</p>

    <form @submit.prevent="onSubmit">
      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" required autocomplete="email" />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" required autocomplete="current-password" />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn block" type="submit" :disabled="loading"><span>{{ loading ? 'Signing in…' : 'Sign in' }}</span><ButtonSpinner v-if="loading" /></button>
    </form>
    <p class="switch"><NuxtLink to="/admin/forgot-password">Forgot password?</NuxtLink></p>
  </div>
</template>

<script setup lang="ts">
import { ShieldCheck } from '@lucide/vue'
definePageMeta({ layout: 'auth' })

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const admin = useAdminStore()
const router = useRouter()

async function onSubmit() {
  loading.value = true
  error.value = ''
  try {
    await admin.login(email.value, password.value)
    router.push('/admin')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not sign in.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-card { width: 100%; max-width: 380px; }
.auth-icon {
  width: 52px; height: 52px; border-radius: 999px;
  background: var(--ink-900); color: white;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 14px;
}
h1 { font-size: 26px; margin-bottom: 4px; }
.subtitle { color: var(--ink-400); margin: 0 0 24px; }
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.switch { text-align: center; margin-top: 20px; font-size: 14px; }
.switch a { color: var(--focus); font-weight: 600; }
</style>
