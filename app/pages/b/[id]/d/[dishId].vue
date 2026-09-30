<script setup lang="ts">
import type { BoardView } from '~~/server/utils/boards'
import type { SavedDish } from '~~/server/utils/dishes'

// The Dish detail (PRD stories 41–45), a child route of its Board: full-screen
// on phones, a side panel over the Board from 768px (440px; 480px from
// 1200px). A native modal <dialog>, like AppSheet: the browser traps focus,
// makes the Board inert and closes it on Escape. The Dish comes from the
// Board the parent page already has; edits go back to it via `edited`.
const props = defineProps<{ board: BoardView }>()
const emit = defineEmits<{ edited: [dish: SavedDish] }>()
const t = useStrings()
const route = useRoute()
const router = useRouter()

const found = computed(() => {
  const dishId = route.params.dishId
  for (const column of props.board.columns) {
    const dish = column.dishes.find(d => d.id === dishId)
    if (dish) return { dish, column }
  }
  return null
})
if (!found.value) throw createError({ statusCode: 404, statusMessage: 'Dish not found', fatal: true })

useHead({ title: () => found.value ? `${found.value.dish.title} · ${t.app.name}` : t.app.name })

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const editing = ref(false)
onMounted(() => dialog.value?.showModal())

// Back to the Board: the way it came if it came from there, so the history
// doesn't grow; a deep link replaces itself with the Board.
const boardPath = computed(() => `/b/${props.board.id}`)
let leaving = false
async function close() {
  if (leaving) return
  leaving = true
  if (router.options.history.state.back === boardPath.value) router.back()
  else await navigateTo(boardPath.value, { replace: true })
}

// Escape leaves edit mode first, then the detail.
function onCancel(event: Event) {
  if (!editing.value) return
  event.preventDefault()
  editing.value = false
}

function onSaved(dish: SavedDish) {
  emit('edited', dish)
  editing.value = false
}
</script>

<template>
  <dialog
    ref="dialog"
    class="detail bg-bg p-0 text-text tablet:shadow-sheet"
    :aria-label="found?.dish.title"
    @cancel="onCancel"
    @close="close"
    @click.self="close"
  >
    <template v-if="found">
      <DishDetailEditor
        v-if="editing"
        :dish="found.dish"
        @saved="onSaved"
        @cancel="editing = false"
      />
      <DishDetailView
        v-else
        :dish="found.dish"
        :board="board"
        :column-name="found.column.name"
        @close="close"
        @edit="editing = true"
      />
    </template>
  </dialog>
</template>

<style scoped>
/* Phone: the whole screen. */
.detail {
  position: fixed;
  inset: 0;
  margin: 0;
  width: 100%;
  max-width: 100%;
  height: 100dvh;
  max-height: 100dvh;
  border: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.detail[open] {
  animation: detail-rise var(--dur-settle) var(--ease-settle);
}
.detail::backdrop {
  background: var(--color-scrim);
}
.detail[open]::backdrop {
  animation: scrim-in var(--dur-fade) var(--ease-fade);
}

/* Tablet and up: a side panel from the right edge, the Board dimmed behind. */
@media (min-width: 768px) {
  .detail {
    left: auto;
    width: 440px;
  }
  .detail[open] {
    animation: detail-slide var(--dur-sheet) var(--ease-sheet);
  }
}
@media (min-width: 1200px) {
  .detail {
    width: 480px;
  }
}

@keyframes detail-rise {
  from { transform: translateY(90px); opacity: 0; }
}
@keyframes detail-slide {
  from { transform: translateX(100%); }
}
@keyframes scrim-in {
  from { opacity: 0; }
}
</style>
