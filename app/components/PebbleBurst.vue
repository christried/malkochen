<script setup lang="ts">
// Five pebbles bursting out of the middle of what holds it and fading (the
// handoff's "drop-burst", 620ms): a Dish landing in a Column tab, a link
// copied. Native, not a clip. Reduced motion: none (main.css collapses
// --dur-drop-burst).
defineProps<{ color: string }>()
</script>

<template>
  <span
    aria-hidden="true"
    class="pointer-events-none absolute inset-0"
  >
    <span
      v-for="n in 5"
      :key="n"
      class="pebble"
      :style="{ '--angle': `${n * 72 - 90}deg`, 'background': color }"
    />
  </span>
</template>

<style scoped>
.pebble {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  margin: -4px;
  border-radius: var(--radius-tab-1);
  opacity: 0;
  animation: burst var(--dur-drop-burst) var(--ease-settle);
}
@keyframes burst {
  0% { opacity: 1; transform: rotate(var(--angle)) translateX(0) scale(1); }
  100% { opacity: 0; transform: rotate(var(--angle)) translateX(34px) scale(.4); }
}
</style>
