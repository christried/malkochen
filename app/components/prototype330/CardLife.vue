<script setup lang="ts">
import type { DishView } from '~~/server/utils/dishes'

// PROTOTYPE #330: throwaway, never merge. What a Dish card shows of its life
// (#318 stories 28 to 31): its Votes, how many Comments, and whether there's
// anything new in its Verlauf since you last opened it. DishCard puts this
// in three places; each variant draws in one of them.
//   A, the bottom row (`row`): quiet line icons with numbers after the
//      adder's picture; something new puts an orange dot on the bubble.
//   B, on the image (`thumb`): a glass chip in the thumb's bottom right;
//      something new turns it into the "Neu" pebble's orange.
//   C, the line under the title (`meta`): emoji and numbers after
//      "3× gekocht"; something new marks the Comments like a highlighter.
const props = defineProps<{ dish: DishView, place: 'row' | 'thumb' | 'meta' }>()
const variant = useP330Variant('card')
const life = computed(() => fakeLife(props.dish))
const any = computed(() => life.value.up + life.value.down + life.value.comments > 0 || life.value.unread)
const shown = computed(() => any.value && (
  (variant.value === 'A' && props.place === 'row')
  || (variant.value === 'B' && props.place === 'thumb')
  || (variant.value === 'C' && props.place === 'meta')))
</script>

<template>
  <template v-if="shown">
    <!-- A: the bottom row. -->
    <span
      v-if="variant === 'A'"
      class="inline-flex min-w-0 items-center gap-2.5 text-caption tabular-nums"
      data-p330-card="A"
    >
      <span
        v-if="life.up"
        class="inline-flex items-center gap-1"
      ><Prototype330Icon
        name="up"
        :size="15"
      />{{ life.up }}</span>
      <span
        v-if="life.down"
        class="inline-flex items-center gap-1"
      ><Prototype330Icon
        name="down"
        :size="15"
      />{{ life.down }}</span>
      <span
        v-if="life.comments || life.unread"
        class="relative inline-flex items-center gap-1"
        :class="{ 'font-semibold text-text': life.unread }"
      >
        <span class="relative inline-flex">
          <Prototype330Icon
            name="bubble"
            :size="16"
          />
          <span
            v-if="life.unread"
            class="p330-dot absolute -right-1 -top-1"
          />
        </span>
        <template v-if="life.comments">{{ life.comments }}</template>
      </span>
    </span>

    <!-- B: on the image. -->
    <span
      v-else-if="variant === 'B'"
      class="p330-chip absolute bottom-1.5 right-1.5 inline-flex items-center gap-1.5 rounded-pill px-1.5 py-[3px] text-[11.5px] font-semibold leading-none tabular-nums"
      :class="life.unread ? 'p330-chip-new text-neu-ink' : 'bg-glass text-text backdrop-blur-sm'"
      data-p330-card="B"
    >
      <span
        v-if="life.up"
        class="inline-flex items-center gap-0.5"
      ><Prototype330Icon
        name="up"
        :size="12"
      />{{ life.up }}</span>
      <span
        v-if="life.down"
        class="inline-flex items-center gap-0.5"
      ><Prototype330Icon
        name="down"
        :size="12"
      />{{ life.down }}</span>
      <span
        v-if="life.comments"
        class="inline-flex items-center gap-0.5"
      ><Prototype330Icon
        name="bubble"
        :size="12"
      />{{ life.comments }}</span>
      <span
        v-if="!life.comments && !life.up && !life.down"
        class="p330-dot"
      />
    </span>

    <!-- C: under the title, after "3× gekocht". -->
    <span
      v-else
      class="inline-flex shrink-0 items-center gap-1.5 pl-1.5 tabular-nums"
      data-p330-card="C"
    >
      <span v-if="life.up"><span class="text-[11px]">👍</span>&#8202;{{ life.up }}</span>
      <span v-if="life.down"><span class="text-[11px]">👎</span>&#8202;{{ life.down }}</span>
      <span
        v-if="life.comments || life.unread"
        :class="{ 'p330-mark': life.unread }"
      ><span class="text-[11px]">💬</span><template v-if="life.comments">&#8202;{{ life.comments }}</template></span>
    </span>
  </template>
</template>

<style scoped>
/* Something new: the "Neu" pebble's orange, ringed in the card's colour so
   it stands off the icon. */
.p330-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--color-neu-accent);
  box-shadow: 0 0 0 2px var(--color-surface);
}
.p330-chip-new {
  background: var(--gradient-neu);
  box-shadow: var(--shadow-neu);
}
/* A highlighter stroke, like a Username's mark. */
.p330-mark {
  margin-inline: -3px;
  padding-inline: 3px;
  border-radius: 6px;
  background: var(--color-name-mark);
  color: var(--color-name-ink);
  font-weight: 600;
}
</style>
