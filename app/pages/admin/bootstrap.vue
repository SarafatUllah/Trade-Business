<template>
  <div class="auth-card">
    <div class="auth-icon"><ShieldCheck :size="26" :stroke-width="2" /></div>
    <h1>Create Super Admin</h1>
    <p class="subtitle">One-time setup — this form only works if no admin exists yet</p>

    <form v-if="!done" @submit.prevent="onSubmit">
      <div class="field">
        <label for="secret">Bootstrap secret<span class="req">*</span></label>
        <input id="secret" v-model="secret" type="password" required autocomplete="off" />
        <small class="hint">The ADMIN_BOOTSTRAP_SECRET value you set in Vercel's environment variables.</small>
      </div>
      <div class="field">
        <label for="name">Your name<span class="req">*</span></label>
        <input id="name" v-model="name" type="text" required />
      </div>
      <div class="field">
        <label for="email">Email<span class="req">*</span></label>
        <input id="email" v-model="email" type="email" required autocomplete="email" />
      </div>
      <div class="field">
        <label for="password">Password<span class="req">*</span></label>
        <input id="password" v-model="password" type="password" required minlength="8" autocomplete="new-password" />
        <FieldMessage v-if="password && password.length < 8" type="error" message="At least 8 characters" />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn block" type="submit" :disabled="loading || password.length < 8">
        <span>{{ loading ? 'Creating…' : 'Create Super Admin' }}</span>
        <ButtonSpinner v-if="loading" />
      </button>
    </form>

    <div v-else class="sent-state">
      <div class="sent-icon"><CircleCheck :size="28" :stroke-width="2.2" /></div>
      <p>Super Admin account created for <strong>{{ email }}</strong>.</p>
      <NuxtLink to="/admin/login" class="btn block" style="margin-top:16px;">Go to admin sign in</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ShieldCheck, CircleCheck } from '@lucide/vue'
definePageMeta({ layout: 'auth' })

const secret = ref('')
const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const done = ref(false)

async function onSubmit() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/admin/bootstrap', {
      method: 'POST',
      body: { secret: secret.value, name: name.value, email: email.value, password: password.value }
    })
    done.value = true
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not create the Super Admin account.'
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
h1 { font-size: 24px; margin-bottom: 4px; }
.subtitle { color: var(--ink-400); margin: 0 0 24px; font-size: 13px; }
.req { color: var(--overdue-600); margin-left: 2px; }
.hint { color: var(--ink-400); font-size: 12px; display: block; margin-top: 4px; }
.error { color: var(--overdue-600); font-size: 14px; margin: -6px 0 14px; }
.sent-state { text-align: center; padding: 12px 0; }
.sent-icon {
  width: 56px; height: 56px; border-radius: 999px; margin: 0 auto 14px;
  background: var(--receivable-100); color: var(--receivable-600);
  display: flex; align-items: center; justify-content: center;
}
</style>
