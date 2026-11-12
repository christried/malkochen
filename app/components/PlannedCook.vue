<script setup lang="ts">
import type { BoardMemberView } from '~~/server/utils/boards'

// The cook's Profile Picture on a Planned Dish (handoff PlannedDish, "cook
// avatar": 28px on a phone, 22px on desktop). For a Member who may move
// Dishes it is a button that opens the CookPicker; for the others the
// picture shows and opens nothing. It pops in when it is set (r14 pop, 460ms)
// and fades out when it goes or is replaced (150ms); reduced motion: it
// swaps. The Transition around it is PlannedDish's.
defineProps<{
  member: BoardMemberView
  canChange: boolean
}>()
const emit = defineEmits<{ open: [anchor: HTMLElement] }>()
const t = useStrings()
const wide = useMediaQuery('(min-width: 1200px)')
</script>

<template>
  <button
    v-if="canChange"
    type="button"
    class="cook-picture flex items-center justify-center rounded-full transition-transform duration-tap ease-tap active:scale-90 focus-visible:outline-2 focus-visible:outline-focus"
    :aria-label="t.week.cookButton(member.name)"
    aria-haspopup="dialog"
    data-planned-cook
    @click="emit('open', $event.currentTarget as HTMLElement)"
  >
    <UserAvatar
      :name="member.name"
      :image="member.image"
      :size="wide ? 22 : 28"
    />
  </button>
  <span
    v-else
    class="cook-picture flex items-center justify-center"
    aria-hidden="true"
    data-planned-cook
  >
    <UserAvatar
      :name="member.name"
      :image="member.image"
      :size="wide ? 22 : 28"
    />
  </span>
</template>

<style scoped>
.cook-picture {
  min-width: 36px;
  height: 44px;
}
@media (min-width: 1200px) {
  .cook-picture {
    min-width: 28px;
    height: 28px;
  }
}
/* Set: pops in (scale 0 to 1.12 to 1). Cleared or replaced: fades out. */
.cook-enter-active {
  animation: cook-pop var(--dur-pop) var(--ease-pop);
}
.cook-leave-active {
  transition: opacity 150ms var(--ease-fade);
}
.cook-leave-to {
  opacity: 0;
}
@keyframes cook-pop {
  0% {
    opacity: 0;
    transform: scale(0);
  }
  60% {
    opacity: 1;
    transform: scale(1.12);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cook-enter-active {
    animation: none;
  }
  .cook-leave-active {
    transition: none;
  }
}
</style>
