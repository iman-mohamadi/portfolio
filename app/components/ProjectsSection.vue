<script setup lang="ts">
const projects = [
  {
    title: 'Raya UI',
    description: 'Founder & Creator — A modern, responsive, and accessible UI component library built for speed and performance.',
    link: 'https://raya-ui.com',
    icon: 'lucide:layout-template',
    tags: ['Founder', 'Open Source', 'UI Library'],
  },
  {
    title: 'Hotelyar',
    description: 'Sole Frontend Developer — The leading hotel booking platform handling high-volume traffic and complex reservation logic.',
    link: 'https://hotelyar.com',
    icon: 'lucide:hotel',
    tags: ['Sole Developer', 'Nuxt', 'High Scale'],
  },
  {
    title: 'Woodcoder',
    description: 'Sole Frontend Developer — Comprehensive educational platform and community resources for developers.',
    link: 'http://woodcoder.com',
    icon: 'lucide:code-2',
    tags: ['Sole Developer', 'Education', 'Community'],
  },
  {
    title: 'Bootimar',
    description: 'Lead Developer — Travel services provider offering unique flight booking and tour experiences.',
    link: 'https://bootimar.com',
    icon: 'lucide:plane',
    tags: ['Travel', 'Services'],
  },
]
</script>

<template>
  <section
    id="projects"
    data-slot="panel"
    class="screen-line-before screen-line-after border-x border-edge"
  >
    <header
      data-slot="panel-header"
      class="screen-line-after px-4"
    >
      <h2
        data-slot="panel-title"
        class="text-3xl font-semibold"
      >
        Real-World Projects
      </h2>
    </header>
    <div
      data-slot="panel-body"
      class="grid grid-cols-1 sm:grid-cols-2"
    >
      <a
        v-for="(project, i) in projects"
        :key="i"
        :href="project.link"
        target="_blank"
        rel="noopener noreferrer"
        class="group flex flex-col gap-3 p-4 border border-edge hover:bg-accent/50 hover:border-accent-foreground/20 transition-all"
      >
        <div class="flex items-start justify-between">
          <div class="size-10 flex items-center justify-center rounded-md border border-border bg-muted/30">
            <UIcon
              :name="project.icon"
              class="size-5 text-foreground"
            />
          </div>
          <UIcon
            name="lucide:arrow-up-right"
            class="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </div>

        <div>
          <h3 class="font-medium text-foreground group-hover:underline underline-offset-4 mb-1">
            {{ project.title }}
          </h3>
          <p class="text-sm text-muted-foreground line-clamp-2">
            {{ project.description }}
          </p>
        </div>

        <div class="mt-auto pt-2 flex gap-2">
          <UBadge
            v-for="tag in project.tags"
            :key="tag"
            color="neutral"
            variant="soft"
            size="xs"
          >
            {{ tag }}
          </UBadge>
        </div>
      </a>
    </div>
  </section>
</template>
