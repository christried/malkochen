<script setup lang="ts">
// PROTOTYPE #330: throwaway. 👍 and 👎 as two round buttons; the one picked
// is filled and springs (pop). `light`: on the page's colours, not the
// toast's inverse ones.
const props = withDefaults(defineProps<{ vote: 'up' | 'down' | null, size?: number, light?: boolean }>(), { size: 38 })
defineEmits<{ pick: [up: boolean] }>()
const base = computed(() => props.light
  ? { off: 'bg-surface-muted', up: 'bg-sage text-sage-ink', down: 'p330-down' }
  : { off: 'bg-on-inverse/12', up: 'bg-sage', down: 'p330-down' })
</script>

<template>
  <span class="flex shrink-0 items-center gap-1">
    <button
      v-for="up in [true, false]"
      :key="String(up)"
      type="button"
      class="p330-vote flex shrink-0 items-center justify-center rounded-full transition duration-tap ease-tap active:scale-90 focus-visible:outline-2 focus-visible:outline-focus"
      :class="vote === (up ? 'up' : 'down') ? ['p330-picked', up ? base.up : base.down] : base.off"
      :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.45)}px` }"
      :aria-label="up ? 'Daumen hoch' : 'Daumen runter'"
      :aria-pressed="vote === (up ? 'up' : 'down')"
      :data-tooltip="up ? 'Daumen hoch' : 'Daumen runter'"
      @click="$emit('pick', up)"
    >
      {{ up ? '👍' : '👎' }}
    </button>
  </span>
</template>

<style scoped>
.p330-down {
  background: color-mix(in oklab, var(--color-carrot) 70%, var(--color-surface));
}
.p330-picked {
  animation: p330-vote-pop var(--dur-pop) var(--ease-pop);
}
@keyframes p330-vote-pop {
  0% { scale: .8; }
}
@media (prefers-reduced-motion: reduce) {
  .p330-picked {
    animation: none;
  }
}
</style>
