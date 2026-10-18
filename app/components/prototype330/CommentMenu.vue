<script setup lang="ts">
// PROTOTYPE #330: throwaway. What you can do with your own Comment.
defineEmits<{ edit: [], remove: [] }>()
const btn = 'rounded-pill px-3 py-1.5 text-label transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus'
</script>

<template>
  <span class="flex gap-1.5">
    <button
      type="button"
      :class="btn"
      class="bg-surface-muted"
      @click="$emit('edit')"
    >
      Bearbeiten
    </button>
    <button
      type="button"
      :class="btn"
      class="bg-surface-muted text-danger"
      @click="$emit('remove')"
    >
      Löschen
    </button>
  </span>
</template>
