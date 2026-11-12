<script setup lang="ts">
import type { DishView } from '~~/server/utils/dishes'
import { columnAccent } from '~/utils/columns'

// The Dish picker (handoff DishPicker): from "+" on a day, and from the empty
// week. Every Dish of the Board in its Column's group, in Board order, the
// Gekocht Column's too; Archived Dishes aren't on the Board. Search at the
// top filters by title as typed, case-insensitive inside words, the match
// tinted; Columns with no match are hidden. Nothing marks a Dish as planned
// already (a Dish can go on many days). Picking one plans it.
const props = defineProps<{
  // Whether the picker is showing: it starts afresh each time.
  open: boolean
  title: string
  closeLabel: string
  columns: { id: string, name: string, dishes: DishView[] }[]
  // The picker is a popover: the search takes focus as it opens.
  popover?: boolean
}>()
const emit = defineEmits<{
  pick: [dish: DishView]
  close: []
}>()
const t = useStrings()

const query = ref('')
const fieldId = useId()
const field = useTemplateRef<HTMLInputElement>('field')

watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  query.value = ''
  await nextTick()
  if (props.popover) field.value?.focus()
}, { immediate: true })

const needle = computed(() => query.value.trim().toLocaleLowerCase())
const groups = computed(() => props.columns
  .map((column, index) => ({
    column,
    accent: columnAccent(index),
    dishes: needle.value ? column.dishes.filter(d => d.title.toLocaleLowerCase().includes(needle.value)) : column.dishes,
  }))
  .filter(group => group.dishes.length > 0))

// A title split into the parts before, in and after the match.
function parts(title: string): { text: string, match: boolean }[] {
  if (!needle.value) return [{ text: title, match: false }]
  const at = title.toLocaleLowerCase().indexOf(needle.value)
  if (at === -1) return [{ text: title, match: false }]
  return [
    { text: title.slice(0, at), match: false },
    { text: title.slice(at, at + needle.value.length), match: true },
    { text: title.slice(at + needle.value.length), match: false },
  ].filter(part => part.text)
}

</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col"
    data-testid="dish-picker"
  >
    <div class="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-3 tablet:pt-5">
      <h2 class="font-display text-[22px] font-medium leading-tight">
        {{ title }}
      </h2>
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="closeLabel"
        @click="emit('close')"
      >
        <AppIcon
          name="close"
          :size="16"
        />
      </button>
    </div>
    <div class="shrink-0 px-5 pb-3">
      <AppField
        :label="t.week.search"
        :control-id="fieldId"
      >
        <span class="field-row">
          <AppIcon
            name="search"
            :size="18"
            class="shrink-0 text-text-muted"
          />
          <input
            :id="fieldId"
            ref="field"
            v-model="query"
            type="search"
            enterkeyhint="search"
            autocomplete="off"
            class="search-field"
            @keydown.esc.stop="query ? (query = '') : emit('close')"
          >
          <button
            v-if="query"
            type="button"
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted"
            :aria-label="t.week.clearSearch"
            @click="query = ''; field?.focus()"
          >
            <AppIcon
              name="close"
              :size="14"
            />
          </button>
        </span>
      </AppField>
    </div>
    <div
      class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6"
      data-picker-list
    >
      <p
        v-if="groups.length === 0"
        class="px-1 py-6 text-center text-body text-text-muted"
        data-testid="picker-empty"
      >
        {{ t.week.noMatch(query.trim()) }}
      </p>
      <section
        v-for="group in groups"
        :key="group.column.id"
        class="mt-3 first:mt-0"
        :aria-label="group.column.name"
      >
        <h3 class="flex items-center gap-2 px-1 pb-2 pt-1 text-[13.5px] font-semibold text-text-muted">
          <span
            class="h-2.5 w-2.5 shrink-0 rounded-full"
            :style="{ background: group.accent }"
            aria-hidden="true"
          />
          <span class="truncate">{{ group.column.name }}</span>
          <span>{{ group.dishes.length }}</span>
        </h3>
        <ul class="overflow-hidden bg-surface shadow-small [border-radius:24px_21px_25px_22px]">
          <li
            v-for="(dish, rowIndex) in group.dishes"
            :key="dish.id"
            class="row border-t border-line first:border-t-0"
            :style="{ '--i': Math.min(rowIndex, 8) }"
          >
            <button
              type="button"
              class="flex min-h-[60px] w-full items-center gap-3 px-3 py-2 text-left transition-transform duration-tap ease-tap active:scale-[.98] active:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              :data-pick-dish="dish.id"
              @click="emit('pick', dish)"
            >
              <span class="h-11 w-11 shrink-0 overflow-hidden rounded-planned-thumb bg-surface-muted">
                <DishImage
                  :image-url="dish.imageUrl"
                  :focus="dish.imageFocus"
                  :placeholder="dish.placeholder"
                  lazy
                />
              </span>
              <span class="pick-title min-w-0 flex-1 font-display text-[16.5px] font-medium leading-tight">
                <template
                  v-for="(part, i) in parts(dish.title)"
                  :key="i"
                >
                  <mark
                    v-if="part.match"
                    class="rounded-[4px] bg-match-tint text-inherit"
                  >{{ part.text }}</mark>
                  <template v-else>{{ part.text }}</template>
                </template>
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.search-field::-webkit-search-cancel-button {
  appearance: none;
}
.pick-title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
/* The rows rise 14px in turn, the first eight (handoff DishPicker). */
.row {
  animation: row-rise 360ms var(--ease-settle) calc(var(--i, 0) * 40ms) backwards;
}
@keyframes row-rise {
  from {
    opacity: 0;
    translate: 0 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .row {
    animation: none;
  }
}
</style>
