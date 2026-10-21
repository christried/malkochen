<script setup lang="ts">
import type { DishView } from '~~/server/utils/dishes'

// What a Dish's card shows of its Dish History (#335; the look #330 picked,
// B): a small frosted chip down the thumb's top right, one line each for
// 👍, 👎 and the Comments with their counts, only those there are. Something
// new in the Dish History since you last opened the Dish turns it the "Neu"
// pebble's orange; with nothing to count, it is then just a dot. It stays
// clear of "Neu" (top left) and the Source badge (bottom left). Screen
// readers hear it as one line instead.
const props = defineProps<{ dish: DishView, isNew?: boolean }>()
const t = useStrings()

const up = computed(() => props.dish.votes.filter(v => v.up).length)
const down = computed(() => props.dish.votes.length - up.value)
const lines = computed(() => [
  { icon: 'up', count: up.value, said: t.dish.votesUp },
  { icon: 'down', count: down.value, said: t.dish.votesDown },
  { icon: 'bubble', count: props.dish.commentCount, said: t.dish.comments },
].filter(line => line.count > 0))
const said = computed(() => [
  ...lines.value.map(line => line.said(line.count)),
  ...props.isNew ? [t.dish.newInHistory] : [],
].join(', '))
</script>

<template>
  <span
    v-if="lines.length || isNew"
    class="absolute right-1.5 top-1.5 inline-flex flex-col items-stretch gap-1 rounded-[11px] p-1.5 text-[11.5px] font-semibold leading-none tabular-nums"
    :class="isNew ? 'chip-new text-neu-ink' : 'bg-glass text-text backdrop-blur-sm'"
    data-history-chip
    :data-new="isNew || undefined"
  >
    <span class="sr-only">{{ said }}</span>
    <span
      v-for="line in lines"
      :key="line.icon"
      aria-hidden="true"
      class="inline-flex items-center justify-between gap-1"
      :data-chip-line="line.icon"
    >
      <svg
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="shrink-0"
      >
        <template v-if="line.icon === 'up'">
          <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
          <path d="M7 10l4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.1 21H7" />
        </template>
        <template v-else-if="line.icon === 'down'">
          <path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1z" />
          <path d="M17 14l-4 8a3 3 0 0 1-3-3v-4H4.5a2 2 0 0 1-2-2.3l1.4-8A2 2 0 0 1 5.9 3H17" />
        </template>
        <path
          v-else
          d="M20 12.5a7.5 7 0 0 1-10.8 6.3L4 20l1.3-4.2A7 7 0 0 1 4.5 12.5 7.75 7 0 0 1 20 12.5z"
        />
      </svg>{{ line.count }}
    </span>
    <span
      v-if="!lines.length"
      aria-hidden="true"
      class="dot"
    />
  </span>
</template>

<style scoped>
.chip-new {
  background: var(--gradient-neu);
  box-shadow: var(--shadow-neu);
}
/* Something new with nothing to count: a dot in the pebble's ink. */
.dot {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
}
</style>
