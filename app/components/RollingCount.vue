<script setup lang="ts">
// A number that rolls 16px up as it changes: the new one pops in from below
// as the old one leaves above (handoff: count change · pop). Reduced motion:
// it just swaps. `text` is what shows, the number by default. `drawn` draws
// it by CSS (::before, from `data-dish-count`), so the text around it, a
// heading's say, stays without it.
const props = defineProps<{ value: number, text?: string, drawn?: boolean }>()
const shown = computed(() => props.text ?? String(props.value))
</script>

<template>
  <span class="relative inline-block overflow-hidden align-bottom">
    <Transition name="count">
      <span
        :key="value"
        class="inline-block"
        :class="{ drawn }"
        :data-dish-count="drawn ? shown : undefined"
      >{{ drawn ? '' : shown }}</span>
    </Transition>
  </span>
</template>

<style scoped>
.drawn::before {
  content: attr(data-dish-count);
}
.count-enter-active,
.count-leave-active {
  transition: translate var(--dur-pop) var(--ease-pop), opacity var(--dur-pop) var(--ease-fade);
}
.count-leave-active {
  position: absolute;
  inset-inline-start: 0;
}
.count-leave-to {
  translate: 0 -16px;
  opacity: 0;
}
.count-enter-from {
  translate: 0 16px;
  opacity: 0;
}
</style>
