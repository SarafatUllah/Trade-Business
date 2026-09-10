<template>
  <div>
    <button v-if="pushSupported && !pushEnabled" class="push-banner" @click="enablePush">
      <span class="push-icon"><BellRing :size="18" :stroke-width="2.2" /></span>
      <span class="push-copy">
        <strong>Enable push notifications</strong>
        <small>Get alerts on this device even when the app is closed</small>
      </span>
      <ChevronRight :size="18" :stroke-width="2.2" class="push-chevron" />
    </button>
    <p v-if="pushStatus" class="push-status">{{ pushStatus }}</p>
    <p v-if="pushError" class="push-error"><CircleAlert :size="14" :stroke-width="2.2" /> {{ pushError }}</p>
    <p v-else-if="pushChecked && !pushSupported && !pushEnabled" class="push-error"><CircleAlert :size="14" :stroke-width="2.2" /> This browser doesn't support push notifications. On iPhone, you must add this site to your Home Screen first (Share → Add to Home Screen), then open it from there.</p>

    <button v-if="pushEnabled" class="test-push-btn" :disabled="testingPush" @click="sendTestPush">
      <span>{{ testingPush ? 'Sending…' : 'Send test notification' }}</span>
      <ButtonSpinner v-if="testingPush" />
    </button>
    <p v-if="testResult" class="test-result">{{ testResult }}</p>

    <div v-if="pending"><SkeletonLoader :rows="4" :row-height="76" /></div>
    <div v-else-if="!data?.length"><EmptyState :icon="BellOff" message="You're all caught up" hint="No new notifications right now." /></div>

    <div v-else class="card full-bleed list-card">
      <div v-for="n in data" :key="n.id" class="notif-row" :class="{ unread: !n.isRead }" @click="markRead(n)">
        <div class="notif-icon" :class="{ unread: !n.isRead }"><Bell :size="17" :stroke-width="2.2" /></div>
        <div class="row-main">
          <div class="row-top">
            <strong>{{ n.title }}</strong>
            <span v-if="!n.isRead" class="unread-dot" />
          </div>
          <small class="body-text">{{ n.body }}</small>
          <small class="time">{{ formatDate(n.createdAt) }}</small>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Bell, BellRing, BellOff, ChevronRight, CircleAlert } from '@lucide/vue'
const { data, pending, refresh } = await useFetch('/api/notifications')

async function markRead(n: any) {
  if (n.isRead) return
  await $fetch(`/api/notifications/${n.id}`, { method: 'PATCH' })
  await refresh()
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const pushSupported = ref(false)
const pushChecked = ref(false)
const pushEnabled = ref(false)
const config = useRuntimeConfig()

onMounted(async () => {
  pushSupported.value = 'serviceWorker' in navigator && 'PushManager' in window
  if (pushSupported.value) {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
    ]).catch(() => null)
    const sub = await reg?.pushManager.getSubscription().catch(() => null)
    pushEnabled.value = !!sub
  }
  pushChecked.value = true
})

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

const pushError = ref('')
const pushStatus = ref('')

async function enablePush() {
  pushError.value = ''
  pushStatus.value = 'Step 1/5: checking browser support…'
  try {
    if (!('Notification' in window)) {
      pushError.value = 'This browser has no Notification API at all (unusual — try Safari from the Home Screen icon specifically).'
      return
    }

    pushStatus.value = 'Step 2/5: requesting permission…'
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      pushError.value = `Browser permission was "${permission}", not granted. Check your phone's notification settings for this app/site.`
      return
    }

    pushStatus.value = 'Step 3/5: waiting for service worker…'
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for the service worker to become ready (10s). Try closing and reopening the app from the Home Screen.')), 10000))
    ])
    const vapidKey = config.public.vapidPublicKey
    if (!vapidKey) {
      pushError.value = 'Push is not configured on the server yet (missing VAPID keys) — this needs to be added and the app redeployed.'
      return
    }

    pushStatus.value = 'Step 4/5: subscribing with the push service…'
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    })

    pushStatus.value = 'Step 5/5: saving subscription…'
    await $fetch('/api/push/subscribe', { method: 'POST', body: sub.toJSON() })
    pushEnabled.value = true
    pushStatus.value = ''
  } catch (err: any) {
    // Surfaced directly in the UI (not just the console) since mobile
    // Safari gives no easy way to check console output.
    pushError.value = `Failed at "${pushStatus.value}" — ${err?.message || err?.name || JSON.stringify(err) || 'unknown error'}`
    console.error('Push subscription failed', err)
  } finally {
    if (!pushEnabled.value) {
      // Leave the last status visible alongside the error so we can see
      // exactly which step it reached, rather than clearing it.
    } else {
      pushStatus.value = ''
    }
  }
}

const testingPush = ref(false)
const testResult = ref('')
async function sendTestPush() {
  testingPush.value = true
  testResult.value = ''
  try {
    await $fetch('/api/push/test', { method: 'POST' })
    testResult.value = 'Sent! You should see a notification appear shortly.'
    await refresh()
  } catch (e: any) {
    testResult.value = `Could not send: ${e?.data?.statusMessage || e?.message || 'unknown error'}`
  } finally {
    testingPush.value = false
  }
}
</script>

<style scoped>
.push-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #2541D6, #4361EE);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  text-align: left;
  box-shadow: 0 8px 20px -8px rgba(67, 97, 238, 0.5);
}
.push-icon {
  width: 36px; height: 36px; border-radius: 999px;
  background: rgba(255,255,255,0.18);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.push-copy { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.push-copy strong { font-size: 14px; }
.push-copy small { opacity: 0.85; font-size: 12px; }
.push-chevron { opacity: 0.8; flex-shrink: 0; }
.push-status { font-size: 12px; color: var(--ink-400); margin: -8px 0 8px; }
.push-error {
  display: flex; align-items: flex-start; gap: 6px;
  font-size: 13px; color: var(--overdue-600);
  background: var(--overdue-100);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  margin: -8px 0 16px;
  line-height: 1.4;
}

.test-push-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%;
  padding: 12px;
  margin-bottom: 16px;
  background: white;
  border: 1.5px dashed var(--line);
  border-radius: var(--radius-sm);
  color: var(--accent);
  font-weight: 600;
  font-size: 14px;
}
.test-result { font-size: 13px; color: var(--ink-400); margin: -8px 0 16px; text-align: center; }

.list-card { padding: 4px 14px; }
.notif-row { display: flex; align-items: flex-start; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.notif-row:last-child { border-bottom: none; }
.notif-row.unread { background: var(--paper-100); margin: 0 -14px; padding: 14px; border-radius: var(--radius-sm); }
.notif-icon {
  width: 38px; height: 38px; border-radius: 999px;
  background: var(--paper-100); color: var(--ink-400);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.notif-icon.unread { background: var(--accent); color: white; }
.row-main { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
.row-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.row-top strong { font-size: 14px; }
.unread-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--overdue-600); flex-shrink: 0; }
.body-text { color: var(--ink-700); line-height: 1.4; }
.time { color: var(--ink-400); font-size: 11px; }
</style>
