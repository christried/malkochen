<script setup lang="ts">
// A Dish's note on its card (#212): the button lying over the note icon the
// card draws (DishCard), outside the card's link, so it is a control of its
// own. Its Tooltip is the note: on hover or keyboard focus with a computer,
// on a tap with a finger (data-tooltip-tap, AppTooltip). Pressing it opens
// nothing; being a button, it starts no drag either (useDishDrag).
// Screen readers get the note in its name.
//
// It goes in the box the card fills. Where the icon is follows DishCard's
// layout: the text column starts at 108px (10px padding, the 86px thumb, a
// 12px gap), and the bottom line ends 14px above the card's bottom (10px
// padding, 4px), its items centred. With "Hinzugefügt von" before it, the
// icon (18px) moves past the avatar (22px) and the gap (8px), and the line
// is the avatar's height. dish-note.spec.ts checks the two line up.
// besideAvatar: "Hinzugefügt von" comes before it.
const props = defineProps<{ note: string, besideAvatar: boolean }>()
const t = useStrings()

const SIZE = 32
const ICON = 18
const AVATAR = 22
const center = computed(() => props.besideAvatar
  ? { x: 108 + AVATAR + 8 + ICON / 2, bottom: 14 + AVATAR / 2 }
  : { x: 108 + ICON / 2, bottom: 14 + ICON / 2 })
</script>

<template>
  <button
    type="button"
    class="absolute rounded-full focus-visible:outline-2 focus-visible:outline-focus"
    :style="{ width: `${SIZE}px`, height: `${SIZE}px`, left: `${center.x - SIZE / 2}px`, bottom: `${center.bottom - SIZE / 2}px` }"
    :aria-label="t.dish.note(note)"
    :data-tooltip="note"
    data-tooltip-tap
    data-note-icon
  />
</template>
