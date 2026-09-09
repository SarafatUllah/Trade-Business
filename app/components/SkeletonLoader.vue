<template>
  <div class="skeleton-stack">
    <div v-for="i in rows" :key="i" class="skeleton" :style="{ height: rowHeight + 'px', marginBottom: gap + 'px' }" />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ rows?: number; rowHeight?: number; gap?: number }>(), {
  rows: 3,
  rowHeight: 64,
  gap: 10
})
</script>

<style scoped>
.skeleton-stack { display: flex; flex-direction: column; }
</style>
