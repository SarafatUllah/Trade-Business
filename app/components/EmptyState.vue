<template>
  <div class="empty-state-modern">
    <div class="empty-icon">
      <component :is="icon" :size="30" :stroke-width="1.6" />
    </div>
    <p class="empty-message">{{ message }}</p>
    <p v-if="hint" class="empty-hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon: Component
  message: string
  hint?: string
}>()
</script>

<style scoped>
.empty-state-modern {
  text-align: center;
  padding: 44px 24px;
  color: var(--ink-400);
}
.empty-icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 14px;
  border-radius: 999px;
  background: var(--paper-100);
  color: var(--ink-400);
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-message { font-size: 14px; font-weight: 600; color: var(--ink-700); margin: 0 0 4px; }
.empty-hint { font-size: 13px; color: var(--ink-400); margin: 0; }
</style>
