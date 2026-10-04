<script setup lang="ts">
// The handoff's EmojiPicker: a grid of 7 emoji tiles to pick a Board's emoji
// from (BOARD_EMOJIS). Native radio buttons, so arrow keys move between
// tiles. The emoji the Board has already is offered first if it isn't one of
// these, so a Board keeps an emoji that's no longer offered until it changes.
const emoji = defineModel<string>({ required: true })
defineProps<{ label: string }>()

const shown = computed(() => BOARD_EMOJIS.includes(emoji.value) ? BOARD_EMOJIS : [emoji.value, ...BOARD_EMOJIS])
const name = useId()
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="grid grid-cols-7 gap-2"
  >
    <label
      v-for="(option, index) in shown"
      :key="option"
      class="tile relative flex aspect-square cursor-pointer items-center justify-center bg-surface-muted text-[26px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus"
      :class="{ selected: option === emoji }"
      :style="{ '--i': index }"
    >
      <input
        v-model="emoji"
        type="radio"
        class="absolute inset-0 m-0 cursor-pointer appearance-none rounded-[14px] focus:outline-none"
        :name="name"
        :value="option"
      >
      {{ option }}
    </label>
  </div>
</template>

<style scoped>
/* Tiles pop in one after another (18ms apart); the chosen one gets an ink
   ring, grows and tilts. Reduced motion: the ring only. */
.tile {
  border-radius: 14px;
  transition: scale var(--dur-tap) var(--ease-pop), rotate var(--dur-tap) var(--ease-pop), box-shadow var(--dur-tap) var(--ease-fade);
  animation: tile-pop var(--dur-pop) var(--ease-pop) backwards;
  animation-delay: calc(var(--i) * 18ms);
}
.tile.selected {
  scale: 1.1;
  rotate: -4deg;
  box-shadow: 0 0 0 2.5px var(--color-text);
}
@keyframes tile-pop {
  from {
    scale: .4;
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tile {
    animation: none;
  }
  .tile.selected {
    scale: none;
    rotate: none;
  }
}
</style>
