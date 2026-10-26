<script setup lang="ts">
import type { BoardListing } from '~~/server/utils/boards'
import { boardLabel } from '~~/shared/board'

// "Kopieren nach…" (#402): the user's other Boards where they may add Dishes,
// one row each, as MoveTargetPicker lists them. Picking one emits `copy` with
// that Board. Fetched when it shows; with none, a line says so. The sheet
// around it gives the heading.
const props = defineProps<{ boardId: string }>()
const emit = defineEmits<{ copy: [toBoard: BoardListing] }>()
const t = useStrings()

// Null until the Boards arrive.
const boards = ref<BoardListing[] | null>(null)
onMounted(async () => {
  const all = await $fetch<BoardListing[]>('/api/boards').catch(() => [])
  // Only those the user may add Dishes to, as a Copy there adds one.
  boards.value = all.filter(b => b.id !== props.boardId && b.permissions.addDishes)
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <button
      v-for="board in boards"
      :key="board.id"
      type="button"
      data-copy-target
      class="flex items-center gap-3 rounded-field bg-surface-muted px-5 py-3.5 text-left text-button transition-[scale,background-color] duration-tap ease-tap hover:bg-line-strong active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
      @click="emit('copy', board)"
    >
      {{ boardLabel(board) }}
    </button>
    <p
      v-if="boards && boards.length === 0"
      class="px-1 text-small text-text-muted"
    >
      {{ t.detail.copyNoBoards }}
    </p>
  </div>
</template>
