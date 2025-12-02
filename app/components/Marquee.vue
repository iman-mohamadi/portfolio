<template>
  <UMarquee
    pause-on-hover
    :overlay="false"
    :repeat="3"
    :ui="{
      root: 'gap-0',
      content: 'py-1',
    }"
  >
    <div class="space-y-3 px-4 py-3 border-x" v-for="item in items" :key="item">
      <p>{{ item.title }}</p>
      <div class="flex items-center gap-2">
        <UAvatar :src="item.avatar" />
        <div class="flex flex-col gap-1">
          <p class="text-sm leading-4 font-semibold text-foreground">
            {{ item.name }}
          </p>
          <p class="text-xs leading-4 text-muted-foreground">{{ item.desc }}</p>
        </div>
      </div>
    </div>
  </UMarquee>
</template>
<script setup>
const items = [
  {
    id: "tm-001",
    title: "This portfolio feels polished and thoughtfully crafted.",
    avatar: "https://api.dicebear.com/9.x/thumbs/svg?seed=tm-001",
    name: "Alex Mercer",
    desc: "Product designer at a fictional studio",
  },
  {
    id: "tm-002",
    title: "Smooth animations, clear layout, and great attention to detail.",
    avatar: "https://api.dicebear.com/9.x/thumbs/svg?seed=tm-002",
    name: "Jordan Lee",
    desc: "Front-end engineer at Imaginary Labs",
  },
  {
    id: "tm-003",
    title: "Exactly the kind of portfolio I’d expect from a modern developer.",
    avatar: "https://api.dicebear.com/9.x/thumbs/svg?seed=tm-003",
    name: "Riley Santos",
    desc: "Fictional hiring manager",
  },
  {
    id: "tm-004",
    title: "Clean, fast, and visually engaging from start to finish.",
    avatar: "https://api.dicebear.com/9.x/thumbs/svg?seed=tm-004",
    name: "Morgan Patel",
    desc: "Creative director at Nowhere Studio",
  },
];
</script>
