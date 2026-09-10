<template>
  <p v-if="type === 'error'" class="field-message error">
    <CircleAlert :size="13" :stroke-width="2.4" /> {{ message }}
  </p>
  <p v-else class="field-message valid">
    <CircleCheck :size="13" :stroke-width="2.4" /> {{ message }}
  </p>
</template>

<script setup lang="ts">
import { CircleAlert, CircleCheck } from '@lucide/vue'

defineProps<{ message: string; type?: 'error' | 'valid' }>()
</script>
