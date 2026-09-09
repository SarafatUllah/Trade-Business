<template>
  <div>
    <button v-if="pushSupported && !pushEnabled" class="btn secondary block enable-push" @click="enablePush">
      🔔 Enable push notifications on this device
    </button>

    <div v-if="pending"><SkeletonLoader :rows="4" :row-height="70" /></div>
    <div v-else-if="!data?.length"><EmptyState :icon="BellOff" message="You're all caught up" hint="No new notifications right now." /></div>

    <div class="card list-card">
      <div v-for="n in data" :key="n.id" class="ledger-row" :class="{ unread: !n.isRead }" @click="markRead(n)">
        <div class="row-main">
          <strong>{{ n.title }}</strong>
          <small>{{ n.body }}</small>
          <small class="time">{{ formatDate(n.createdAt) }}</small>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BellOff } from '@lucide/vue'
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
const pushEnabled = ref(false)
const config = useRuntimeConfig()

onMounted(async () => {
  pushSupported.value = 'serviceWorker' in navigator && 'PushManager' in window
  if (pushSupported.value) {
    const reg = await navigator.serviceWorker.ready.catch(() => null)
    const sub = await reg?.pushManager.getSubscription().catch(() => null)
    pushEnabled.value = !!sub
  }
})

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

async function enablePush() {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return
    const reg = await navigator.serviceWorker.ready
    const vapidKey = config.public.vapidPublicKey
    if (!vapidKey) {
      alert('Push notifications are not configured on the server yet (missing VAPID keys).')
      return
    }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    })
    await $fetch('/api/push/subscribe', { method: 'POST', body: sub.toJSON() })
    pushEnabled.value = true
  } catch (err) {
    console.error('Push subscription failed', err)
  }
}
</script>

<style scoped>
.enable-push { margin-bottom: 16px; }
.list-card { padding: 4px 12px; }
.row-main { display: flex; flex-direction: column; gap: 2px; }
.row-main small { color: var(--ink-400); }
.time { font-size: 11px; }
.unread { background: var(--paper-100); border-radius: var(--radius-sm); }
</style>
