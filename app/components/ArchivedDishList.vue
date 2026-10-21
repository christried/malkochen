<script setup lang="ts">
import type { ArchivedDishView } from '~~/server/utils/dishes'
import { daysLeft } from '~/utils/archive'

// The Board's Archive in Board Settings (#336; CONTEXT.md: Archived Dish):
// each Archived Dish, the newest archived first, with who archived it, when,
// and how many days it has left. A Member with "archive Dishes" restores
// any (`mayRestore`), one without it those they added; the Owner also
// deletes one for good (`purge`, which asks first).
defineProps<{ dishes: ArchivedDishView[], isOwner: boolean, mayRestore: (dish: ArchivedDishView) => boolean }>()
defineEmits<{ restore: [dish: ArchivedDishView], purge: [dish: ArchivedDishView] }>()
const t = useStrings()

// Who archived the Dish and when; only when, if who is unknown.
function archivedLine({ archivedBy, archivedAt }: ArchivedDishView) {
  const at = new Date(archivedAt)
  return archivedBy ? t.settings.archivedBy(archivedBy.name, at) : t.settings.archivedOn(at)
}
</script>

<template>
  <p
    v-if="dishes.length === 0"
    class="rounded-field bg-surface-muted px-4 py-3.5 text-small text-text-muted"
  >
    {{ t.settings.archiveEmpty }}
  </p>
  <ul
    v-else
    class="flex flex-col gap-2"
    :aria-label="t.settings.archive"
  >
    <li
      v-for="dish in dishes"
      :key="dish.id"
      class="flex flex-col gap-3 rounded-field bg-surface-muted p-3"
      data-archived-dish
    >
      <div class="flex items-center gap-3">
        <div class="h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-surface">
          <DishImage
            :image-url="dish.imageUrl"
            :focus="dish.imageFocus"
            :placeholder="dish.placeholder"
            lazy
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-button">
            {{ dish.title }}
          </p>
          <p class="text-small text-text-muted">
            {{ archivedLine(dish) }}
          </p>
          <p class="text-small text-text-muted">
            {{ t.settings.daysLeft(daysLeft(dish.purgesAt)) }}
          </p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-if="mayRestore(dish)"
          type="button"
          class="rounded-pill bg-inverse px-5 py-3 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          :aria-label="t.settings.restoreDish(dish.title)"
          @click="$emit('restore', dish)"
        >
          {{ t.settings.restore }}
        </button>
        <DangerButton
          v-if="isOwner"
          :aria-label="t.settings.purgeDish(dish.title)"
          aria-haspopup="dialog"
          @click="$emit('purge', dish)"
        >
          {{ t.settings.deleteForGood }}
        </DangerButton>
      </div>
    </li>
  </ul>
</template>
