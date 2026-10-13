<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { ColumnView } from '~~/server/utils/columns'
import { columnDeletion } from '~~/shared/placement'

// Board settings' Columns (PRD stories 57–60): each can be renamed in place,
// given a Column Subtitle or have it cleared (not the Gekocht Column, whose
// subtitle is fixed), moved with ↑/↓ or dragged by its grip (the row's left
// end, up to just before its name), and deleted,
// except the Gekocht Column (marked) and the last Column besides it. The
// order changes here while dragging; `reordered` says a move is done, with
// the order before it.
export type ColumnRow = ColumnView & { count: number }

const columns = defineModel<ColumnRow[]>({ required: true })
const emit = defineEmits<{
  rename: [column: ColumnRow, name: string]
  subtitle: [column: ColumnRow, subtitle: string | null]
  reordered: [before: ColumnRow[]]
  delete: [column: ColumnRow]
}>()
const t = useStrings()
const lastHintId = useId()

// Its Dishes, if it has any, go where the delete sheet says, so only being
// the Gekocht Column or the last other one keeps a Column.
const deletable = (column: ColumnRow) => !('refusal' in columnDeletion(columns.value, column))

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

// A blank subtitle clears it.
function setSubtitle(column: ColumnRow, event: Event) {
  const input = event.target as HTMLInputElement
  const subtitle = input.value.trim() || null
  input.value = subtitle ?? ''
  if (subtitle !== column.subtitle) emit('subtitle', column, subtitle)
}

const list = useTemplateRef<ComponentPublicInstance>('list')
const listEl = () => list.value?.$el as HTMLElement | undefined

const STEPS = [
  { delta: -1, icon: 'up', label: t.settings.moveUp, tip: t.settings.moveUpTip },
  { delta: 1, icon: 'down', label: t.settings.moveDown, tip: t.settings.moveDownTip },
] as const

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
// The drag listens on the window, not on the grip: a swap can move the
// dragged row within the list, which takes the grip's pointer capture away,
// and a release away from the grip then never reached it.
const drag = ref<{ id: string, dy: number, pointerId: number } | null>(null)
let start = { y: 0, before: [] as ColumnRow[] }

const onWindow = [['pointermove', follow], ['pointerup', drop], ['pointercancel', drop], ['blur', drop]] as const
function stopListening() {
  for (const [type, listener] of onWindow) window.removeEventListener(type, listener as EventListener)
}
onBeforeUnmount(stopListening)

function lift(column: ColumnRow, event: PointerEvent) {
  if (event.button !== 0) return
  drop()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  start = { y: event.clientY, before: [...columns.value] }
  drag.value = { id: column.id, dy: 0, pointerId: event.pointerId }
  for (const [type, listener] of onWindow) window.addEventListener(type, listener as EventListener)
  hapticTick()
}

function follow(event: PointerEvent) {
  const el = listEl()
  if (!drag.value || !el || event.pointerId !== drag.value.pointerId) return
  // The button is already up: let go where no pointerup reached the page.
  if (event.buttons === 0) {
    drop()
    return
  }
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

// Also when the window loses focus mid-drag, and before a new lift, so no
// drag outlives its pointer.
function drop(event?: Event) {
  if (event instanceof PointerEvent && event.pointerId !== drag.value?.pointerId) return
  stopListening()
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
      class="row flex items-center gap-1 rounded-field bg-surface-muted pr-2"
      :class="{ lifted: drag?.id === column.id }"
      :style="drag?.id === column.id ? { translate: `0 ${drag.dy}px` } : undefined"
      :data-column-row="column.id"
    >
      <!-- The grab area (#206): the row's whole left end, as high as the row,
           with the Column's accent dot in it, up to just before the name. -->
      <span
        aria-hidden="true"
        data-grip
        class="grip flex shrink-0 cursor-grab items-center gap-2 self-stretch pl-2.5 pr-2 text-text-muted"
        @pointerdown="lift(column, $event)"
      >
        <AppIcon
          name="grip"
          :size="24"
        />
        <span
          class="h-3 w-3 shrink-0 rounded-full"
          :style="{ background: columnAccent(index) }"
        />
      </span>
      <div class="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
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
        <input
          v-if="!column.isGekocht"
          type="text"
          :value="column.subtitle ?? ''"
          :aria-label="t.settings.columnSubtitle(column.name)"
          :placeholder="t.settings.subtitlePrompt"
          maxlength="40"
          autocomplete="off"
          class="w-full rounded-field bg-transparent px-2 py-1 font-display text-body-serif italic text-text-muted placeholder:text-text-muted/70 focus:bg-surface focus:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          @change="setSubtitle(column, $event)"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        >
        <span
          v-else
          class="px-2 py-1 font-display text-body-serif italic text-text-muted"
        >{{ column.subtitle }}</span>
        <span class="px-2 text-small text-text-muted">
          {{ t.settings.dishCount(column.count) }}<template v-if="column.isGekocht"> · {{ t.settings.notDeletable }}</template>
        </span>
      </div>
      <button
        v-for="{ delta, icon, label, tip } in STEPS"
        :key="delta"
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="label(column.name)"
        :data-tooltip="tip"
        :disabled="!columns[index + delta]"
        :data-step="delta"
        @click="step(column, delta)"
      >
        <AppIcon :name="icon" />
      </button>
      <button
        v-if="!column.isGekocht"
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="t.settings.deleteColumn(column.name)"
        :data-tooltip="t.settings.deleteColumnTip"
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
/* The grip takes the row's rounded left end; a finger on it drags the row
   instead of scrolling the page. Under a mouse it darkens to the text colour. */
.grip {
  touch-action: none;
  border-radius: var(--radius-field);
  border-start-end-radius: 0;
  border-end-end-radius: 0;
  transition: color var(--dur-fade) var(--ease-fade);
}
@media (hover: hover) and (pointer: fine) {
  .grip:hover {
    color: var(--color-text);
  }
}
.lifted .grip {
  color: var(--color-text);
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
