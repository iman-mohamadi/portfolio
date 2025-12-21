<template>
  <UApp class="bg-grid min-h-screen">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Analytics />
  </UApp>
</template>

<script setup>
import { Analytics } from '@vercel/analytics/nuxt'

useHead({ htmlAttrs: { class: 'dark', }, },)
</script>

<style>
</style>
