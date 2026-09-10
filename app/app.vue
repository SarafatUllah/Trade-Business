<template>
  <div>
    <NuxtLoadingIndicator color="#4361EE" :height="3" />
    <PageLoadingOverlay />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
