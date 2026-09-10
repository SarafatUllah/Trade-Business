<template>
  <div class="auth-card">
    <div class="auth-icon"><Building2 :size="26" :stroke-width="2" /></div>
    <h1>Create your account</h1>
    <p class="subtitle">Set up your business ledger</p>

    <form @submit.prevent="onSubmit">
      <div class="field">
        <label for="signupCode">Signup code<span class="req">*</span></label>
        <input
          id="signupCode" v-model="signupCode" type="text" required placeholder="e.g. TRADE-7K2P9X" style="text-transform: uppercase;"
          :class="{ invalid: touched.signupCode && !signupCode.trim() }" @blur="touched.signupCode = true"
        />
        <FieldMessage v-if="touched.signupCode && !signupCode.trim()" type="error" message="A signup code is required — contact your admin to get one" />
        <small class="hint">New here? Contact us to arrange payment (or a free trial) and receive a signup code.</small>
      </div>
      <div class="field">
        <label for="businessName">Business name</label>
        <input
          id="businessName" v-model="businessName" type="text" required placeholder="e.g. Karim Trading"
          :class="{ invalid: touched.businessName && !businessName.trim() }" @blur="touched.businessName = true"
        />
        <FieldMessage v-if="touched.businessName && !businessName.trim()" type="error" message="Business name is required" />
      </div>
      <div class="field">
        <label for="name">Your name</label>
        <input
          id="name" v-model="name" type="text" required autocomplete="name"
          :class="{ invalid: touched.name && !name.trim() }" @blur="touched.name = true"
        />
        <FieldMessage v-if="touched.name && !name.trim()" type="error" message="Your name is required" />
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input
          id="email" v-model="email" type="email" required autocomplete="email"
          :class="{ invalid: touched.email && !isValidEmail }" @blur="touched.email = true"
        />
        <FieldMessage v-if="touched.email && !isValidEmail" type="error" message="Enter a valid email address" />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input
          id="password" v-model="password" type="password" required minlength="8" autocomplete="new-password"
          :class="{ invalid: touched.password && !isValidPassword }" @blur="touched.password = true"
        />
        <FieldMessage v-if="touched.password && !isValidPassword" type="error" message="At least 8 characters" />
        <FieldMessage v-else-if="touched.password && isValidPassword" type="valid" message="Looks good" />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn block" type="submit" :disabled="loading"><span>{{ loading ? 'Creating…' : 'Create account' }}</span><ButtonSpinner v-if="loading" /></button>
    </form>

    <p class="switch">Already have an account? <NuxtLink to="/login">Sign in</NuxtLink></p>
  </div>
</template>

<script setup lang="ts">
import { Building2 } from '@lucide/vue'
definePageMeta({ layout: 'auth' })

const businessName = ref('')
const name = ref('')
const email = ref('')
const password = ref('')
const signupCode = ref('')
const loading = ref(false)
const error = ref('')
const auth = useAuthStore()
const router = useRouter()

const touched = reactive({ businessName: false, name: false, email: false, password: false, signupCode: false })
const isValidEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))
const isValidPassword = computed(() => password.value.length >= 8)
const isFormValid = computed(() => businessName.value.trim() && name.value.trim() && isValidEmail.value && isValidPassword.value && signupCode.value.trim())

async function onSubmit() {
  touched.businessName = true
  touched.name = true
  touched.email = true
  touched.password = true
  touched.signupCode = true
  if (!isFormValid.value) return
  loading.value = true
  error.value = ''
  try {
    await auth.register({ name: name.value, email: email.value, password: password.value, businessName: businessName.value, signupCode: signupCode.value.trim() })
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
.auth-icon {
  width: 52px; height: 52px; border-radius: 999px;
  background: var(--paper-100); color: var(--accent);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 14px;
}
h1 { font-size: 26px; margin-bottom: 4px; }
.subtitle { color: var(--ink-400); margin: 0 0 24px; }
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.switch { text-align: center; margin-top: 20px; font-size: 14px; color: var(--ink-400); }
.switch a { color: var(--focus); font-weight: 600; }
.req { color: var(--overdue-600); margin-left: 2px; }
.hint { color: var(--ink-400); font-size: 12px; display: block; margin-top: 4px; }
</style>
