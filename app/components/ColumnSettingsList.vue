<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'

// Board settings' Columns (PRD stories 57–60): each can be renamed in place,
// moved with ↑/↓ or dragged by its grip, and deleted, except the Gekocht
// Column (marked) and the last Column besides it. The order changes here
// while dragging; `reordered` says a move is done, with the order before it.
export interface ColumnRow {
  id: string
  name: string
  isGekocht: boolean
  count: number
}

const columns = defineModel<ColumnRow[]>({ required: true })
const emit = defineEmits<{
  rename: [column: ColumnRow, name: string]
  reordered: [before: ColumnRow[]]
  delete: [column: ColumnRow]
}>()
const t = useStrings()
const lastHintId = useId()

const deletable = (column: ColumnRow) => columns.value.some(c => c !== column && !c.isGekocht)

// A blank name puts the old one back.
function rename(column: ColumnRow, event: Event) {
  const input = event.target as HTMLInputElement
  const name = input.value.trim()
  if (!name || name === column.name) {
    input.value = column.name
    return
  }
  emit('rename', column, name)
}

const list = useTemplateRef<ComponentPublicInstance>('list')
const listEl = () => list.value?.$el as HTMLElement | undefined

// ↑/↓. When the Column reaches either end, focus goes to the other arrow.
async function step(column: ColumnRow, delta: -1 | 1) {
  const before = [...columns.value]
  const from = before.indexOf(column)
  const to = from + delta
  if (to < 0 || to >= before.length) return
  const next = [...before]
  next.splice(from, 1)
  next.splice(to, 0, column)
  columns.value = next
  emit('reordered', before)
  await nextTick()
  const row = listEl()?.querySelector(`[data-column-row="${column.id}"]`)
  if (document.activeElement instanceof HTMLButtonElement && document.activeElement.disabled) {
    row?.querySelector<HTMLButtonElement>(`[data-step="${-delta}"]`)?.focus()
  }
}

// Dragging by the grip (pointer only; ↑/↓ do the same by keyboard): the row
// lifts and follows the finger, and passing half of a neighbour swaps the two.
const drag = ref<{ id: string, dy: number } | null>(null)
let start = { y: 0, before: [] as ColumnRow[] }

function lift(column: ColumnRow, event: PointerEvent) {
  if (event.button !== 0) return
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  start = { y: event.clientY, before: [...columns.value] }
  drag.value = { id: column.id, dy: 0 }
  hapticTick()
}

function follow(event: PointerEvent) {
  const el = listEl()
  if (!drag.value || !el) return
  const rows = [...el.querySelectorAll<HTMLElement>('[data-column-row]')]
  const index = columns.value.findIndex(c => c.id === drag.value?.id)
  let dy = event.clientY - start.y
  const gap = 8
  const next = rows[index + 1]
  const previous = rows[index - 1]
  if (next && dy > next.offsetHeight / 2) swap(index, index + 1, next.offsetHeight + gap)
  else if (previous && dy < -previous.offsetHeight / 2) swap(index, index - 1, -(previous.offsetHeight + gap))
  dy = event.clientY - start.y
  drag.value.dy = dy
}

function swap(from: number, to: number, shift: number) {
  const next = [...columns.value]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  columns.value = next
  start.y += shift
  hapticTick()
}

function drop() {
  if (!drag.value) return
  drag.value = null
  if (start.before.some((c, i) => c !== columns.value[i])) emit('reordered', start.before)
}
</script>

<template>
  <TransitionGroup
    ref="list"
    tag="ol"
    name="row"
    class="flex flex-col gap-2"
    :aria-label="t.settings.columns"
  >
    <li
      v-for="(column, index) in columns"
      :key="column.id"
      class="row flex items-center gap-2 rounded-field bg-surface-muted py-2 pl-1 pr-2"
      :class="{ lifted: drag?.id === column.id }"
      :style="drag?.id === column.id ? { translate: `0 ${drag.dy}px` } : undefined"
      :data-column-row="column.id"
    >
      <span
        aria-hidden="true"
        data-grip
        class="grip flex h-11 w-8 shrink-0 cursor-grab items-center justify-center text-text-muted"
        @pointerdown="lift(column, $event)"
        @pointermove="follow"
        @pointerup="drop"
        @pointercancel="drop"
      >
        <AppIcon
          name="grip"
          :size="18"
        />
      </span>
      <span
        aria-hidden="true"
        class="h-3 w-3 shrink-0 rounded-full"
        :style="{ background: columnAccent(index) }"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <input
          type="text"
          :value="column.name"
          :aria-label="t.settings.columnName(column.name)"
          required
          maxlength="40"
          autocomplete="off"
          class="w-full rounded-field bg-transparent px-2 py-1.5 font-display text-title-s text-text focus:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          @change="rename(column, $event)"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        >
        <span class="px-2 text-small text-text-muted">
          {{ t.settings.dishCount(column.count) }}<template v-if="column.isGekocht"> · {{ t.settings.gekocht }}</template>
        </span>
      </div>
      <button
        type="button"
        class="step flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="t.settings.moveUp(column.name)"
        :disabled="index === 0"
        data-step="-1"
        @click="step(column, -1)"
      >
        <AppIcon name="up" />
      </button>
      <button
        type="button"
        class="step flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="t.settings.moveDown(column.name)"
        :disabled="index === columns.length - 1"
        data-step="1"
        @click="step(column, 1)"
      >
        <AppIcon name="down" />
      </button>
      <button
        v-if="!column.isGekocht"
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="t.settings.deleteColumn(column.name)"
        :aria-describedby="deletable(column) ? undefined : lastHintId"
        :disabled="!deletable(column)"
        @click="emit('delete', column)"
      >
        <AppIcon
          name="close"
          :size="16"
        />
      </button>
      <span
        v-else
        aria-hidden="true"
        class="h-9 w-9 shrink-0"
      />
    </li>
  </TransitionGroup>
  <p
    v-if="!columns.some(deletable)"
    :id="lastHintId"
    class="mt-2 px-1 text-small text-text-muted"
  >
    {{ t.settings.lastColumn }}
  </p>
</template>

<style scoped>
/* Rows make room for a moved or dragged one (settle); a dragged row lifts
   like a dragged card: a little larger, tilted, with the lift shadow.
   Reduced motion: no scale or tilt, an ink outline instead. */
.row-move {
  transition: transform var(--dur-settle) var(--ease-settle);
}
.row-enter-active,
.row-leave-active {
  transition: opacity var(--dur-fade) var(--ease-fade), scale var(--dur-fade) var(--ease-settle);
}
.row-enter-from,
.row-leave-to {
  opacity: 0;
  scale: .95;
}
.row-leave-active {
  position: absolute;
  inset-inline: 0;
}
.grip {
  touch-action: none;
}
.lifted {
  position: relative;
  z-index: 1;
  scale: 1.03;
  rotate: -1deg;
  box-shadow: var(--shadow-lift);
  transition: scale var(--dur-lift) var(--ease-lift), rotate var(--dur-lift) var(--ease-lift);
}
.lifted.row-move {
  transition: none;
}
.lifted .grip {
  cursor: grabbing;
}
@media (prefers-reduced-motion: reduce) {
  .lifted {
    scale: none;
    rotate: none;
    outline: 2px solid var(--color-text);
  }
}
</style>
