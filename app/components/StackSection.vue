<template>
  <section
    data-slot="panel"
    class="screen-line-before screen-line-after border-x border-edge"
    id="stack"
  >
    <header data-slot="panel-header" class="screen-line-after px-4">
      <h2 data-slot="panel-title" class="text-3xl font-semibold">Stack</h2>
    </header>
    <div
      data-slot="panel-body"
      class="p-4 [--pattern-foreground:var(--color-zinc-950)]/5 dark:[--pattern-foreground:var(--color-white)]/5 bg-[radial-gradient(var(--pattern-foreground)_1px,transparent_0)] bg-size-[10px_10px] bg-center bg-zinc-950/0.75 dark:bg-white/0.75"
    >
      <ul class="flex flex-wrap gap-4 select-none">
        <li v-for="item in stackItems" :key="item.label" class="flex">
          <UTooltip :text="item.label">
            <UIcon :name="item.icon" class="size-10" />
          </UTooltip>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
interface StackItem {
  label: string;
  icon?: string;
}

const stackItems: StackItem[] = [
  {
    label: "TypeScript",
    icon: "devicon:typescript",
  },
  {
    label: "JavaScript",
    icon: "devicon:javascript",
  },
  {
    label: "HTML",
    icon: "devicon:html5",
  },
  {
    label: "CSS",
    icon: "devicon:css3",
  },
  {
    label: "Vue.js",
    icon: "devicon:vuejs",
  },
  {
    label: "Nuxt.js",
    icon: "devicon:nuxtjs",
  },
  {
    label: "React",
    icon: "devicon:react",
  },
  {
    label: "Next.js",
    icon: "devicon:nextjs",
  },
  {
    label: "Tailwind CSS",
    icon: "devicon:tailwindcss",
  },

  {
    label: "Git",
    icon: "devicon:git",
  },
  {
    label: "GitHub",
    icon: "devicon:github",
  },

  {
    label: "Node.js",
    icon: "devicon:nodejs",
  },
  {
    label: "Vite",
    icon: "devicon:vitejs",
  },
  {
    label: "Vitest",
    icon: "devicon:vitest",
  },
  {
    label: "Figma",
    icon: "devicon:figma",
  },
  {
    label: "Adobe Photoshop",
    icon: "devicon:photoshop",
  },
  {
    label: "ChatGPT",
    icon: "hugeicons:chat-gpt",
  },
];
</script>
