<script setup lang="ts">
// "Wie war's?" 👍 and 👎 (#334; the look #330 picked): two round buttons,
// the Member's own Vote filled (thumbs up in sage, down in carrot), and it
// springs in as it's picked. Picking the filled one again takes the Vote
// back (`vote` null). `inverse`: on the Toast's inverse colours, not the
// page's.
const props = withDefaults(defineProps<{ mine: boolean | null, inverse?: boolean, size?: number }>(), { size: 40 })
const emit = defineEmits<{ vote: [up: boolean | null] }>()
const t = useStrings()

function pick(up: boolean) {
  emit('vote', props.mine === up ? null : up)
}
</script>

<template>
  <span class="flex shrink-0 items-center gap-1">
    <button
      v-for="up in [true, false]"
      :key="String(up)"
      type="button"
      class="flex shrink-0 items-center justify-center rounded-full transition duration-tap ease-tap active:scale-90 focus-visible:outline-2 focus-visible:outline-focus"
      :class="mine === up ? ['picked', up ? 'bg-sage text-sage-ink' : 'down'] : inverse ? 'bg-on-inverse/12' : 'bg-surface-muted'"
      :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.45)}px` }"
      :aria-label="up ? t.history.voteUp : t.history.voteDown"
      :aria-pressed="mine === up"
      :data-tooltip="up ? t.history.voteUp : t.history.voteDown"
      :data-vote="up ? 'up' : 'down'"
      @click="pick(up)"
    >
      <span aria-hidden="true">{{ up ? '👍' : '👎' }}</span>
    </button>
  </span>
</template>

<style scoped>
.down {
  background: color-mix(in oklab, var(--color-carrot) 70%, var(--color-surface));
}
/* Picked, it springs in from 80%. */
.picked {
  animation: vote-pop var(--dur-pop) var(--ease-pop);
}
@keyframes vote-pop {
  0% { scale: .8; }
}
@media (prefers-reduced-motion: reduce) {
  .picked {
    animation: none;
  }
}
</style>
