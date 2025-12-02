<script setup lang="ts">
</script>

<template>
  <section
    id="about"
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
        About
      </h2>
    </header>
    <div
      data-slot="panel-body"
      class="p-4"
    >
      <div
        data-slot="prose"
        class="prose max-w-none prose-zinc dark:prose-invert prose-headings:text-balance prose-a:font-medium prose-a:wrap-break-word prose-a:text-foreground prose-a:underline prose-a:underline-offset-4 prose-code:rounded-md prose-code:border prose-code:bg-muted/50 prose-code:px-[0.3rem] prose-code:py-[0.2rem] prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-hr:border-edge prose-blockquote:border-s-border prose-blockquote:[&amp;_p:first-of-type]:before:content-none prose-blockquote:[&amp;_p:last-of-type]:after:content-none prose-sm font-mono text-foreground"
      >
        <ul class="list-disc px-4 space-y-2">
          <li>
            <strong>Front-End Engineer</strong> with <strong>8+ years of experience</strong>,
            focused on crafting highly interactive, visually polished user interfaces with
            clean architecture and obsessive attention to detail.
          </li>

          <li>
            Specialized in <strong>Vue.js</strong>, <strong>Nuxt.js</strong>, <strong>Three.js</strong>,
            and modern front-end tooling—building animation-rich, 3D-enhanced experiences
            that feel smooth, fast, and intentionally designed.
          </li>

          <li>
            Passionate about experimenting with creative UI/UX, micro-interactions,
            scroll-based animations, and blending 3D elements with traditional web layouts
            to create immersive portfolio and product experiences.
          </li>

          <li>
            Experienced in crafting <strong>high-performance</strong> interfaces using
            Tailwind, GSAP, Lenis, ScrollTrigger, and custom shader-based effects in Three.js,
            pushing the boundary of what a web experience can look and feel like.
          </li>

          <li>
            Currently focused on building a modern, animated portfolio showcasing
            interactive 3D backgrounds, smooth page transitions, and refined component-level
            details — designed to help clients and companies instantly feel the quality of
            your work.
          </li>

          <li>
            Based in <strong>Tehran</strong> — working with international clients and teams,
            and continuously exploring new ideas through personal projects, prototypes,
            and experimental UI concepts.
          </li>
        </ul>

      </div>
    </div>
  </section>
</template>

<style scoped>

</style>
