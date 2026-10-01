<script setup lang="ts">
import type { CookingView } from '~~/server/utils/cookings'
import type { DishView } from '~~/server/utils/dishes'

// A Dish's Cooking History in its detail (PRD stories 48, 53–55): "3×
// gekocht · zuletzt 12. Sept.", "Gekocht ✓", and each Cooking (the handoff's
// CookingHistoryEntry) with its date, note and who recorded it, a way to add
// or change the note and to delete it. Never cooked, it loops the handoff's
// "never-cooked" clip instead. A Cooking still being recorded
// shows, but can't be changed yet.
const props = defineProps<{ dish: DishView }>()
defineEmits<{ cook: [origin: Point], note: [cooking: CookingView], delete: [cooking: CookingView] }>()
const t = useStrings()
const headingId = useId()

const summary = computed(() => {
  const [last] = props.dish.cookings
  return last ? t.cooking.summary(props.dish.cookings.length, new Date(last.cookedAt)) : t.detail.cookingHistoryEmpty
})

// A Cooking of the last day gets the sage date pebble.
const DAY_MS = 24 * 60 * 60 * 1000
const isFresh = (cooking: CookingView) => Date.now() - Date.parse(cooking.cookedAt) < DAY_MS

// A Cooking keeps its key when the server fills in its id.
const keys = new WeakMap<CookingView, number>()
let lastKey = 0
function keyOf(cooking: CookingView): number {
  let key = keys.get(cooking)
  if (key === undefined) keys.set(cooking, key = ++lastKey)
  return key
}
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="mt-2 flex flex-col gap-4 border-t border-line pt-5"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="flex flex-col gap-1">
        <h2
          :id="headingId"
          class="font-display text-title-s"
        >
          {{ t.detail.cookingHistory }}
        </h2>
        <p
          class="text-small text-text-muted"
          data-cooking-summary
        >
          {{ summary }}
        </p>
      </div>
      <CookButton
        class="shrink-0 px-4 py-2.5"
        :cooked="dish.cookings.length > 0"
        @cook="origin => $emit('cook', origin)"
      />
    </div>

    <div
      v-if="!dish.cookings.length"
      class="mx-auto aspect-[510/354] w-[min(60vw,220px)]"
    >
      <MotionClip
        src="/clips/never-cooked"
        play
      />
    </div>

    <TransitionGroup
      tag="ol"
      name="cooking"
      class="relative flex flex-col gap-2"
    >
      <li
        v-for="cooking in dish.cookings"
        :key="keyOf(cooking)"
        class="flex items-start gap-3 rounded-[16px] bg-surface-muted p-3"
        data-cooking
      >
        <span
          class="shrink-0 rounded-pill px-2.5 py-1 text-label"
          :class="isFresh(cooking) ? 'bg-sage text-sage-ink' : 'bg-surface text-text'"
        >{{ t.cooking.date(new Date(cooking.cookedAt)) }}</span>
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <p
            v-if="cooking.note"
            class="whitespace-pre-line break-words font-display text-body-serif"
          >
            {{ cooking.note }}
          </p>
          <span
            v-if="cooking.recordedBy"
            class="flex items-center gap-1.5 text-caption text-text-muted"
          >
            <UserAvatar
              :name="cooking.recordedBy.name"
              :image="cooking.recordedBy.image"
              :size="18"
            />
            {{ t.cooking.by(cooking.recordedBy.name) }}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <button
            type="button"
            class="flex h-9 items-center justify-center rounded-pill px-2.5 text-label text-text-muted transition-transform duration-tap ease-tap hover:bg-surface active:scale-95 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-focus"
            :class="{ 'w-9 px-0': cooking.note, 'note-glow relative': !cooking.note && isFresh(cooking) }"
            :aria-label="(cooking.note ? t.cooking.editNoteLabel : t.cooking.addNoteLabel)(new Date(cooking.cookedAt))"
            :disabled="!cooking.id"
            @click="$emit('note', cooking)"
          >
            <svg
              v-if="cooking.note"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13 7l4 4" /></svg>
            <template v-else>
              {{ t.cooking.addNote }}
            </template>
          </button>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-transform duration-tap ease-tap hover:bg-surface active:scale-95 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-focus"
            :aria-label="t.cooking.deleteLabel(new Date(cooking.cookedAt))"
            :disabled="!cooking.id"
            @click="$emit('delete', cooking)"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
          </button>
        </div>
      </li>
    </TransitionGroup>
  </section>
</template>

<style scoped>
/* handoff CookingHistoryEntry. Added: it opens (max-height 0 → 96px) and
   fades in. Deleted: it slides 40px aside and the list closes up; restored,
   it comes back with a little overshoot. Reduced motion: it only fades. */
.cooking-enter-active {
  overflow: hidden;
  transition: max-height var(--dur-settle) var(--ease-settle), opacity var(--dur-fade) var(--ease-fade);
}
.cooking-enter-from {
  max-height: 0;
  opacity: 0;
}
.cooking-enter-to {
  max-height: 96px;
}
.cooking-leave-active {
  position: absolute;
  inset-inline: 0;
  transition: translate var(--dur-cooking-collapse) var(--ease-swoosh), opacity var(--dur-cooking-collapse) var(--ease-fade);
}
.cooking-leave-to {
  translate: 40px 0;
  opacity: 0;
}
.cooking-move {
  transition: transform var(--dur-settle) var(--ease-settle);
}
/* "+ Notiz" on a fresh Cooking without a note glows three times: a butter
   ring swells out of it and fades. Reduced motion: no glow. */
.note-glow::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 0 0 2px var(--color-focus);
  opacity: 0;
  pointer-events: none;
  animation: note-glow 1.2s var(--ease-fade) 600ms 3;
}
@keyframes note-glow {
  0% { opacity: .9; scale: 1; }
  100% { opacity: 0; scale: 1.25; }
}
@media (prefers-reduced-motion: reduce) {
  .note-glow::after {
    animation: none;
  }
  .cooking-enter-active {
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
  .cooking-enter-from,
  .cooking-enter-to {
    max-height: none;
  }
  .cooking-leave-active {
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
  .cooking-leave-to {
    translate: none;
  }
}
</style>
