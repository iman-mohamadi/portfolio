<script setup lang="ts">
const localDate = ref('',)
const offsetText = ref('',)

function updateTimes() {
  const now = new Date()

  // local time
  localDate.value = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  },)

  // tehran time
  const tehran = new Date().toLocaleTimeString([], {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  },)

  // get diff in minutes
  const [lh, lm,] = localDate.value.split(':',).map(Number,)
  const [th, tm,] = tehran.split(':',).map(Number,)

  let diff = (th * 60 + tm) - (lh * 60 + lm)

  // normalize to 24h cycle
  if (diff > 720) diff -= 1440 // > 12h ahead
  if (diff < -720) diff += 1440 // > 12h behind

  const sign = diff >= 0 ? '+' : '-'
  const hours = Math.floor(Math.abs(diff,) / 60,)
  const minutes = Math.abs(diff,) % 60

  offsetText.value = `${sign}${hours}${minutes ? ':' + minutes.toString().padStart(2, '0',) : 'h'} ahead`
}

updateTimes()
</script>

<template>
  <section
    data-slot="panel"
    class="screen-line-before screen-line-after border-x border-edge"
  >
    <h2 class="sr-only">
      Overview
    </h2>
    <div
      data-slot="panel-body"
      class="p-4 space-y-2.5"
    >
      <div class="flex items-center gap-4 font-mono text-sm">
        <div
          class="flex size-6 shrink-0 items-center justify-center rounded-lg border border-muted-foreground/15 bg-muted ring-1 ring-edge ring-offset-1 ring-offset-background [&amp;_svg]:pointer-events-none [&amp;_svg]:text-muted-foreground [&amp;_svg:not([class*='size-'])]:size-4"
          aria-hidden="true"
        >
          <UIcon
            name="lucide-code-xml"
            class="size-4"
          />
        </div>
        <p class="text-balance">
          Senior Frontend Developer &amp; UI Design Lead @<a
            class="underline-offset-4 hover:underline ml-0.5 font-medium"
            target="_blank"
            rel="noopener noreferrer"
            href="https://hotelyar.com/"
            aria-label="hotelyar website"
          >Arnika Mehr Kish</a>
        </p>
      </div>
      <div class="grid gap-x-12 gap-y-2.5 sm:grid-cols-2">
        <div class="flex items-center gap-4 font-mono text-sm">
          <div
            class="flex size-6 shrink-0 items-center justify-center rounded-lg border border-muted-foreground/15 bg-muted ring-1 ring-edge ring-offset-1 ring-offset-background [&amp;_svg]:pointer-events-none [&amp;_svg]:text-muted-foreground [&amp;_svg:not([class*='size-'])]:size-4"
            aria-hidden="true"
          >
            <UIcon
              name="lucide-map-pin"
              class="size-4"
            />
          </div>
          <p class="text-balance">
            <a
              class="underline-offset-4 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              href="https://maps.app.goo.gl/iq61TJbCbRrVwg3N9"
              aria-label="Location: Tehran, Iran"
            >Tehran, Iran</a>
          </p>
        </div>
        <div class="flex items-center gap-4 font-mono text-sm">
          <div
            class="flex size-6 shrink-0 items-center justify-center rounded-lg border border-muted-foreground/15 bg-muted ring-1 ring-edge ring-offset-1 ring-offset-background [&amp;_svg]:pointer-events-none [&amp;_svg]:text-muted-foreground [&amp;_svg:not([class*='size-'])]:size-4"
            aria-hidden="true"
          >
            <UIcon
              name="lucide-clock-8"
              class="size-4"
            />
          </div>
          <p
            class="text-balance"
            :aria-label="`Current local time: ${localDate}`"
          >
            <span>{{ localDate }}</span>
            <span
              class="text-muted-foreground"
              aria-hidden="true"
            >
              // {{ offsetText }}
            </span>
          </p>
        </div>
        <div class="flex items-center gap-4 font-mono text-sm">
          <div
            class="flex size-6 shrink-0 items-center justify-center rounded-lg border border-muted-foreground/15 bg-muted ring-1 ring-edge ring-offset-1 ring-offset-background [&amp;_svg]:pointer-events-none [&amp;_svg]:text-muted-foreground [&amp;_svg:not([class*='size-'])]:size-4"
            aria-hidden="true"
          >
            <UIcon
              name="lucide-phone"
              class="size-4"
            />
          </div>
          <p class="text-balance">
            <a
              class="underline-offset-4 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              href="tel:+989384249894"
              aria-label="Call +98 938 424 9894"
            >+98 938 424 9894</a>
          </p>
        </div>
        <div class="flex items-center gap-4 font-mono text-sm">
          <div
            class="flex size-6 shrink-0 items-center justify-center rounded-lg border border-muted-foreground/15 bg-muted ring-1 ring-edge ring-offset-1 ring-offset-background [&amp;_svg]:pointer-events-none [&amp;_svg]:text-muted-foreground [&amp;_svg:not([class*='size-'])]:size-4"
            aria-hidden="true"
          >
            <UIcon
              name="lucide-mail"
              class="size-4"
            />
          </div>
          <p class="text-balance">
            <a
              class="underline-offset-4 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              href="mailto:im4n.mhmdi@gmail.com"
              aria-label="Send email to im4n.mhmdi@gmail.com"
            >im4n.mhmdi@gmail.com</a>
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
