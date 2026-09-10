<template>
  <svg class="btn-spinner" viewBox="0 0 24 24" fill="none" :width="size" :height="size">
    <circle class="track" cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="3" opacity="0.25" />
    <path class="arc" d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 18 })
</script>

<style scoped>
.btn-spinner { animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
