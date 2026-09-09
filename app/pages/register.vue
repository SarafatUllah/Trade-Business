<template>
  <div class="auth-card">
    <h1>Create your account</h1>
    <p class="subtitle">Set up your business ledger</p>

    <form @submit.prevent="onSubmit">
      <div class="field">
        <label for="businessName">Business name</label>
        <input id="businessName" v-model="businessName" type="text" required placeholder="e.g. Karim Trading" />
      </div>
      <div class="field">
        <label for="name">Your name</label>
        <input id="name" v-model="name" type="text" required autocomplete="name" />
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" required autocomplete="email" />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" required minlength="8" autocomplete="new-password" />
        <small style="color: var(--ink-400)">At least 8 characters</small>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn block" type="submit" :disabled="loading">{{ loading ? 'Creating…' : 'Create account' }}</button>
    </form>

    <p class="switch">Already have an account? <NuxtLink to="/login">Sign in</NuxtLink></p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const businessName = ref('')
const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const auth = useAuthStore()
const router = useRouter()

async function onSubmit() {
  loading.value = true
  error.value = ''
  try {
    await auth.register({ name: name.value, email: email.value, password: password.value, businessName: businessName.value })
    router.push('/')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not create your account.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-card { width: 100%; max-width: 380px; }
h1 { font-size: 26px; margin-bottom: 4px; }
.subtitle { color: var(--ink-400); margin: 0 0 24px; }
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.switch { text-align: center; margin-top: 20px; font-size: 14px; color: var(--ink-400); }
.switch a { color: var(--focus); font-weight: 600; }
</style>
