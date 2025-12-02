<template>
  <div
    class="panel flex items-center justify-center gap-3 border"
  >
    <div
      class="border border-border flex justify-center items-center p-2"
    >
      <UIcon
        :name="icon"
        class="size-10"
      />
    </div>
    <div>
      <div class="mono">
        {{ title }}
      </div>
      <div
        class="small-muted"
        style="margin-top:6px"
      >
        {{ subtitle }}
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ title: String, subtitle: String, icon: String, },)
</script>
