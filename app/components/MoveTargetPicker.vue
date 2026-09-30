<script setup lang="ts">
import type { BoardListing } from '~~/server/utils/boards'
import type { ColumnView } from '~~/server/utils/columns'

// "Verschieben nach…" (PRD stories 33, 46): this Board's other Columns
// first, then each of the user's other Boards with its Columns. Picking one
// emits `move` with the Column and, for another Board, that Board. The other
// Boards are fetched when it shows; until they arrive, this Board's Columns
// are there already.
const props = defineProps<{
  board: { id: string, columns: ColumnView[] }
  fromColumnId: string
}>()
defineEmits<{ move: [columnId: string, toBoard: BoardListing | null] }>()
const t = useStrings()

const others = ref<BoardListing[]>([])
onMounted(async () => {
  const boards = await $fetch<BoardListing[]>('/api/boards').catch(() => [])
  others.value = boards.filter(b => b.id !== props.board.id)
})

const here = computed(() => props.board.columns
  .map((column, index) => ({ column, accent: columnAccent(index) }))
  .filter(({ column }) => column.id !== props.fromColumnId))
</script>

<template>
  <div class="flex flex-col gap-2">
    <p class="px-1 text-overline uppercase text-text-muted">
      {{ others.length ? t.dish.thisBoard : t.dish.moveTo }}
    </p>
    <button
      v-for="{ column, accent } in here"
      :key="column.id"
      type="button"
      class="flex items-center gap-3 rounded-field bg-surface-muted px-5 py-3.5 text-left text-button transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
      @click="$emit('move', column.id, null)"
    >
      <span
        aria-hidden="true"
        class="h-3 w-3 shrink-0 rounded-full"
        :style="{ background: accent }"
      />
      {{ column.name }}
    </button>
    <section
      v-for="other in others"
      :key="other.id"
      class="mt-3 flex flex-col gap-2"
      :aria-label="other.name"
    >
      <p class="px-1 text-overline uppercase text-text-muted">
        <span aria-hidden="true">{{ other.emoji }}</span> {{ other.name }}
      </p>
      <button
        v-for="(column, index) in other.columns"
        :key="column.id"
        type="button"
        class="flex items-center gap-3 rounded-field bg-surface-muted px-5 py-3.5 text-left text-button transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        @click="$emit('move', column.id, other)"
      >
        <span
          aria-hidden="true"
          class="h-3 w-3 shrink-0 rounded-full"
          :style="{ background: columnAccent(index) }"
        />
        {{ column.name }}
      </button>
    </section>
  </div>
</template>
