<template>
  <div>
    <section>
      <div class="container">
        <div
          class="text-black dark:text-white aspect-2/1 border-x border-edge select-none sm:aspect-3/1 flex items-center justify-center text-black dark:text-white screen-line-before screen-line-after before:-top-px after:-bottom-px bg-black/0.75 bg-[radial-gradient(var(--pattern-foreground)_1px,transparent_0)] bg-size-[10px_10px] bg-center [--pattern-foreground:var(--color-zinc-950)]/5 dark:bg-white/0.75 dark:[--pattern-foreground:var(--color-white)]/5"
          data-state="closed"
          data-slot="context-menu-trigger"
          style="-webkit-touch-callout:none"
        >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 14.449999809265137 111.1500015258789 32.14999771118164" data-asc="0.92" width="111.1500015258789" height="32.14999771118164"><defs/><g fill="#000000"><g transform="translate(0, 0)"><path d="M0 46.60L0 41.60L4.55 41.60L4.55 19.50L0 19.50L0 14.45L14.15 14.45L14.15 19.50L9.55 19.50L9.55 41.60L14.15 41.60L14.15 46.60L0 46.60ZM18.70 46.60L18.70 23.50L32.85 23.50L32.85 28.05L36.85 28.05L36.85 23.50L46.50 23.50L46.50 28.05L51.00 28.05L51.00 46.60L46 46.60L46 28.50L37.35 28.50L37.35 46.60L32.35 46.60L32.35 28.50L23.75 28.50L23.75 46.60L18.70 46.60ZM60.10 46.60L60.10 42.10L55.55 42.10L55.55 28.05L60.10 28.05L60.10 23.50L74.20 23.50L74.20 28.05L78.80 28.05L78.80 41.60L83.35 41.60L83.35 46.60L78.30 46.60L78.30 42.10L74.20 42.10L74.20 46.60L60.10 46.60M60.60 41.60L73.70 41.60L73.70 28.50L60.60 28.50L60.60 41.60ZM87.90 46.60L87.90 23.50L106.55 23.50L106.55 28.05L111.15 28.05L111.15 46.60L106.05 46.60L106.05 28.50L92.95 28.50L92.95 46.60L87.90 46.60Z"/></g></g></svg>
        </div>
      </div>
    </section>
    <section class="container">
      <div class="screen-line-after flex border-x border-edge">
        <div class="shrink-0 border-r border-edge">
          <div class="mx-0.5 my-[3px]">
            <img
              class="size-32 rounded-full ring-1 ring-border ring-offset-2 ring-offset-background select-none sm:size-40"
              alt="Iman Mohammadi's avatar"
              src="/avatar.png"
              fetchpriority="high"
            >
          </div>
        </div>
        <div class="flex flex-1 flex-col">
          <div class="flex grow items-end pb-1 pl-4" />
          <div class="border-t border-edge">
            <div class="flex items-center gap-2 pl-4">
              <h1 class="-translate-y-px text-3xl font-semibold">
                Iman Mohammadi
              </h1>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                class="size-4.5 text-info select-none"
                aria-label="Verified"
              >
                <path
                  fill="currentColor"
                  d="M24 12a4.454 4.454 0 0 0-2.564-3.91 4.437 4.437 0 0 0-.948-4.578 4.436 4.436 0 0 0-4.577-.948A4.44 4.44 0 0 0 12 0a4.423 4.423 0 0 0-3.9 2.564 4.434 4.434 0 0 0-2.43-.178 4.425 4.425 0 0 0-2.158 1.126 4.42 4.42 0 0 0-1.12 2.156 4.42 4.42 0 0 0 .183 2.421A4.456 4.456 0 0 0 0 12a4.465 4.465 0 0 0 2.576 3.91 4.433 4.433 0 0 0 .936 4.577 4.459 4.459 0 0 0 4.577.95A4.454 4.454 0 0 0 12 24a4.439 4.439 0 0 0 3.91-2.563 4.26 4.26 0 0 0 5.526-5.526A4.453 4.453 0 0 0 24 12Zm-13.709 4.917-4.38-4.378 1.652-1.663 2.646 2.646L15.83 7.4l1.72 1.591-7.258 7.926Z"
                />
              </svg>
              <button
                class="relative text-muted-foreground transition-[color,scale] select-none hover:text-foreground active:scale-[0.9] after:absolute after:-inset-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="lucide lucide-volume2 lucide-volume-2 size-4.5"
                  aria-hidden="true"
                >
                  <path
                    d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"
                  />
                  <path d="M16 9a5 5 0 0 1 0 6" />
                  <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
                </svg>
                <span class="sr-only">Pronounce my name</span>
              </button>
            </div>
            <div
              class="relative h-12.5 border-t border-edge py-1 pl-4 sm:h-9 overflow-hidden flex flex-col justify-center"
            >
              <p class="inline-block font-mono text-sm text-balance text-muted-foreground fade-slide">
                Design Engineer
              </p>
              <p class="inline-block font-mono text-sm text-balance text-muted-foreground fade-slide">
                Creating with code. Small details matter.
              </p>
              <p class="inline-block font-mono text-sm text-balance text-muted-foreground fade-slide">
                Open Source Contributor
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
    <Divider />
    <div class="container">
      <AboutSection />
    </div>
    <Divider />
    <div class="container">
      <SocialSection />
    </div>
    <Divider />
    <div class="container">
      <AboutTextSection />
    </div>
  </div>
</template>
