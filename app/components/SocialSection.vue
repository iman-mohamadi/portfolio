<script setup lang="ts">
const socials = [
  {
    icon: 'lucide:x',
    title: 'X (formerly Twitter)',
    link: 'x.com/iman-mohammadi',
    id: 'Iman Mohammadi',
  },
  {
    icon: 'lucide:linkedin',
    title: 'LinkedIn',
    link: 'LinkedIn.com/iman-mohammadi',
    id: 'Iman Mohammadi',
  },
]
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <a
      v-for="(social, i) in socials"
      class="group/link flex cursor-pointer border-r border-l items-center gap-4 p-4 pr-2 transition-colors hover:bg-accent2 max-sm:screen-line-before max-sm:screen-line-after sm:nth-[2n+1]:screen-line-before sm:nth-[2n+1]:screen-line-after"
      :href="social.link"
      target="_blank"
      rel="noopener"
      :key="i"
    >
      <div class="relative size-12 shrink-0 flex items-center justify-center border rounded-full">
        <UIcon
          :name="social.icon"
          class="size-7"
        />
      </div>
      <div class="flex-1">
        <h3 class="flex items-center font-medium underline-offset-4 group-hover/link:underline">
          {{ social.title }}
        </h3>
        <p class="text-sm text-muted-foreground">{{ social.id }}</p>
      </div>
      <UIcon
        name="lucide-arrow-up-right"
        class="size-4"
      />
    </a>
  </div>
</template>
