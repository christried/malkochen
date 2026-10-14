<script setup lang="ts">
// Who added a Dish, on its card (#213): the button lying over the Profile
// Picture the card draws (DishCard), outside the card's link like the note's
// (NoteButton), so hovering it or tapping it opens their popover
// (PersonPopover) and neither opens the Dish nor, being a button, starts a
// drag (useDishDrag). Screen readers get "Hinzugefügt von …" as its name.
//
// It goes in the box the card fills. Where the picture is follows DishCard's
// layout: the text column starts at 108px (10px padding, the 86px thumb, a
// 12px gap), and the bottom line ends 14px above the card's bottom (10px
// padding, 4px), as high as the picture (22px). user-popover.spec.ts checks
// the two line up.
defineProps<{
  person: { id: string, name: string, image: string | null }
  boardId: string
}>()
const t = useStrings()

const SIZE = 32
const AVATAR = 22
const center = { x: 108 + AVATAR / 2, bottom: 14 + AVATAR / 2 }
</script>

<template>
  <PersonPopover
    :person="person"
    :board-id="boardId"
    class="absolute rounded-full transition-colors duration-tap ease-tap hover:bg-text/10 focus-visible:outline-2 focus-visible:outline-focus"
    :style="{ width: `${SIZE}px`, height: `${SIZE}px`, left: `${center.x - SIZE / 2}px`, bottom: `${center.bottom - SIZE / 2}px` }"
    :aria-label="t.dish.addedBy(person.name)"
  />
</template>
