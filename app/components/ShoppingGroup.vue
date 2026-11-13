<script setup lang="ts">
import type { ShoppingEntry, ShoppingGroup as Group } from '~/board/shopping-list'
import { dishPath } from '~~/shared/address'

// One group of the Shopping List (#536): "Sonstiges" first, then one group per
// Dish in the order put on. Its Dish's image and title open its detail while
// the Dish is on the Board; once it has gone, the title stays alone. Its lines
// are ShoppingItem rows; a line's events come up here with the line attached.
defineProps<{
  group: Group
  editingId: string | null
}>()
const emit = defineEmits<{
  tick: [entry: ShoppingEntry]
  edit: [entry: ShoppingEntry]
  save: [entry: ShoppingEntry, text: string]
  cancel: []
  remove: [entry: ShoppingEntry]
}>()

const t = useStrings()
const address = useOpenBoardAddress()
</script>

<template>
  <section
    class="rounded-card bg-surface p-2 shadow-card"
    :data-shopping-group="group.dishId ?? 'other'"
  >
    <h3 class="flex min-h-11 items-center gap-3 px-2 pt-1">
      <NuxtLink
        v-if="group.dish"
        :to="dishPath(address, group.dish)"
        class="flex min-w-0 items-center gap-3 rounded-[14px] focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="t.shopping.openDish(group.dish.title)"
      >
        <span class="block h-10 w-10 shrink-0 overflow-hidden rounded-[12px] bg-surface-muted">
          <DishImage
            :image-url="group.dish.imageUrl"
            :focus="group.dish.imageFocus"
            :placeholder="group.dish.placeholder"
            lazy
          />
        </span>
        <span class="truncate font-display text-[19px] font-medium leading-tight">{{ group.title }}</span>
      </NuxtLink>
      <span
        v-else
        class="truncate font-display text-[19px] font-medium leading-tight"
      >{{ group.dishId === null ? t.shopping.other : group.title }}</span>
    </h3>
    <TransitionGroup
      tag="ul"
      name="line"
      class="mt-1"
    >
      <ShoppingItem
        v-for="entry in group.items"
        :key="entry.id"
        :entry="entry"
        :editing="editingId === entry.id"
        @tick="emit('tick', entry)"
        @edit="emit('edit', entry)"
        @save="text => emit('save', entry, text)"
        @cancel="emit('cancel')"
        @remove="emit('remove', entry)"
      />
    </TransitionGroup>
    <slot />
  </section>
</template>

<style scoped>
/* A tick: the line settles to the bottom of its group (move, settle 480ms);
   one coming or going fades. Reduced motion: no moving, a fade. */
.line-move {
  transition: translate var(--dur-settle) var(--ease-settle);
}
.line-enter-active,
.line-leave-active {
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.line-leave-active {
  position: absolute;
  visibility: hidden;
}
.line-enter-from {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .line-move {
    transition: none;
  }
}
</style>
