<script setup lang="ts">
import type { BoardListing } from '~~/server/utils/boards'
import type { ColumnView } from '~~/server/utils/columns'
import { boardLabel } from '~~/shared/board'

// "Verschieben nach…" (PRD stories 33, 46): this Board's other Columns
// first, then each of the user's other Boards with its Columns. Picking one
// emits `move` with the Column and, for another Board, that Board. The other
// Boards are fetched when it shows; until they arrive, this Board's Columns
// are there already. The sheet around it gives the heading. Several
// Dishes at once (#218) can't go into a Gekocht Column (`noGekocht`):
// cooking stays one Dish at a time.
const props = defineProps<{
  board: { id: string, columns: ColumnView[] }
  // The Column the Dish (or every selected Dish) is in, not offered.
  fromColumnId?: string | null
  noGekocht?: boolean
}>()
defineEmits<{ move: [columnId: string, toBoard: BoardListing | null] }>()
const t = useStrings()

const otherBoards = ref<BoardListing[]>([])
onMounted(async () => {
  const boards = await $fetch<BoardListing[]>('/api/boards').catch(() => [])
  otherBoards.value = boards.filter(b => b.id !== props.board.id)
})

// One group per Board, each Column with its accent. This Board's group is
// named only once there are others to tell it from.
const offered = (column: ColumnView) => column.id !== props.fromColumnId && !(props.noGekocht && column.isGekocht)
const groups = computed(() => [
  {
    id: props.board.id,
    label: otherBoards.value.length ? t.dish.thisBoard : null,
    toBoard: null,
    columns: props.board.columns.map((column, index) => ({ column, accent: columnAccent(index) })).filter(({ column }) => offered(column)),
  },
  ...otherBoards.value.map(other => ({
    id: other.id,
    label: boardLabel(other),
    toBoard: other,
    columns: other.columns.map((column, index) => ({ column, accent: columnAccent(index) })).filter(({ column }) => offered(column)),
  })),
])
</script>

<template>
  <div class="flex flex-col gap-5">
    <section
      v-for="group in groups"
      :key="group.id"
      class="flex flex-col gap-2"
      :aria-label="group.toBoard?.name"
    >
      <p
        v-if="group.label"
        class="px-1 text-overline uppercase text-text-muted"
      >
        {{ group.label }}
      </p>
      <button
        v-for="{ column, accent } in group.columns"
        :key="column.id"
        type="button"
        class="flex items-center gap-3 rounded-field bg-surface-muted px-5 py-3.5 text-left text-button transition-[scale,background-color] duration-tap ease-tap hover:bg-line-strong active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        @click="$emit('move', column.id, group.toBoard)"
      >
        <span
          aria-hidden="true"
          class="h-3 w-3 shrink-0 rounded-full"
          :style="{ background: accent }"
        />
        {{ column.name }}
      </button>
    </section>
  </div>
</template>
