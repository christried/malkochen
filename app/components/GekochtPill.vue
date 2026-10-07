<script setup lang="ts">
// The Gekocht celebration at the top of the screen (#105, variant B): a
// short inverse pill with Topfbert sitting in it, saying one of his cheers,
// and "Gekocht ✓"; for a Dish moved into another Board's Gekocht Column, a
// second line names that Board ("in 🍲 Familie"). It slides down from the
// top edge a moment after the confetti and goes by itself
// (useGekochtPill). Its actions are the Gekocht toast's, at the bottom.
// Decoration beside that toast, which says it all to screen readers.
// Put it beside the page's Toast: on the Board, in the Dish detail, in a
// celebration over them. Reduced motion: it only fades.
// `belowTabs`: on the Board, phones put it just below where the sticky
// Column tabs stick (#170, option B), so it doesn't hide them or the Gekocht
// tab's bump; it stays there when they aren't stuck, rather than jumping.
// Their bar is 51px tall (ColumnTabs: 8px around a 35px tab), and Topfbert
// pokes 3px out of the pill's top. Tablet and desktop have no tabs.
defineProps<{ belowTabs?: boolean }>()
const t = useStrings()
const { pill } = useGekochtPill()

// Inside a modal, it's lifted into the top layer (useTopLayerInModal).
const place = useTemplateRef<HTMLElement>('place')
useTopLayerInModal(place)
</script>

<template>
  <!-- Its place, always in the page (useGekochtPill: `origin`), a pill's
       height; as for AppToast, the popover's own styles are undone. -->
  <div
    ref="place"
    popover="manual"
    aria-hidden="true"
    class="pointer-events-none fixed inset-x-4 bottom-auto z-toast m-0 flex h-14 w-auto items-center justify-center overflow-visible border-0 bg-transparent p-0 text-inherit tablet:top-8"
    :class="belowTabs ? 'top-[60px]' : 'top-6'"
    data-gekocht-pill-place
  >
    <Transition name="pill">
      <div
        v-if="pill"
        class="flex max-w-full items-center gap-2 rounded-pill bg-inverse py-2 pl-1 pr-5 text-small text-on-inverse shadow-fab"
        data-gekocht-pill
      >
        <TopfbertCheer
          :key="pill.key"
          :cheer="pill.cheer"
          class="-my-5 shrink-0"
        />
        <p class="min-w-0">
          <span class="block whitespace-nowrap text-button">{{ t.dish.cook }}</span>
          <span
            v-if="pill.board"
            class="block truncate text-caption opacity-75"
          >{{ t.dish.cookedOn(pill.board) }}</span>
        </p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* In: down from the top edge, 380ms with a little overshoot (sheet), a
   moment after the confetti. Out: up, 300ms. */
.pill-enter-active {
  transition: translate 380ms var(--ease-sheet), opacity var(--dur-fade) var(--ease-fade);
  transition-delay: var(--dur-toast-delay);
}
.pill-leave-active {
  transition: translate 300ms var(--ease-swoosh), opacity 300ms var(--ease-fade);
}
.pill-enter-from,
.pill-leave-to {
  translate: 0 -150px;
  opacity: 0;
}
/* Reduced motion: it only fades. */
@media (prefers-reduced-motion: reduce) {
  .pill-enter-from,
  .pill-leave-to {
    translate: none;
  }
  .pill-leave-active {
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
}
</style>
