<template>
  <div>
    <ThreeCanvas />
    <div class="relative z-10 bg-black/50">
      <header
        class="border-panel"
        style="border-bottom: 1px solid var(--border)"
      >
        <div
          class="container flex items-center justify-between border-r border-l py-3"
        >
          <div class="flex items-center gap-4">
            <nav class="small-muted">
              <a class="px-3" href="#projects">Projects</a>
              <a class="px-3" href="#about">About</a>
              <a class="px-3" href="#contact">Contact</a>
            </nav>
          </div>
        </div>
      </header>

      <UMain>
        <div
          class="w-5 hidden border-x border-x-(--pattern-fg) bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed [--pattern-fg:var(--color-black)]/5 md:block dark:[--pattern-fg:var(--color-white)]/10"
        ></div>
        <slot />
      </UMain>

      <footer class="border-panel small-muted">
        <div class="container border-l border-r p-2">
          © {{ new Date().getFullYear() }} — Iman Mohammadi — Built with ❤️
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup></script>
