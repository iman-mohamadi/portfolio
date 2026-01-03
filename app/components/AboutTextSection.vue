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
            <strong>Founder of Raya UI</strong> and Senior Frontend Engineer with <strong>8+ years of experience</strong>.
            I specialize in architecting large-scale applications and building high-performance, open-source UI libraries.
          </li>

          <li>
            As the <strong>Sole Frontend Developer</strong> for major platforms like <strong>Hotelyar</strong> and <strong>Woodcoder</strong>,
            I have single-handedly managed complex architectures, ensuring speed, reliability, and responsiveness for high-volume traffic.
          </li>

          <li>
            Specialized in <strong>Vue.js</strong>, <strong>Nuxt.js</strong>, and <strong>Three.js</strong>,
            blending technical engineering with creative visuals to build animation-rich, 3D-enhanced experiences.
          </li>

          <li>
            Passionate about open source contribution and experimenting with creative UI/UX,
            micro-interactions, and custom shader-based effects to push the boundaries of web development.
          </li>

          <li>
            Based in <strong>Tehran</strong> — continuously exploring new ideas through personal projects
            and delivering production-ready software used by thousands of users.
          </li>
        </ul>

      </div>
    </div>
  </section>
</template>

<style scoped>

</style>
