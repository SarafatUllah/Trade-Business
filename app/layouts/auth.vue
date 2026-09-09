<template>
  <div class="auth-shell">
    <slot />
  </div>
</template>

<style scoped>
.auth-shell {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--paper-0);
}
</style>
