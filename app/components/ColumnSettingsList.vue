<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { ColumnView } from '~~/server/utils/columns'
import { columnDeletion } from '~~/shared/placement'

// Board settings' Columns (PRD stories 57–60), as a list that opens (#285):
// each Column is a compact row (its name, Column Subtitle and Dish count)
// that opens, one at a time, to be renamed, given a Column Subtitle or have
// it cleared (not the Gekocht Column, whose subtitle is fixed), moved with
// "Nach oben" / "Nach unten", and deleted, except the Gekocht Column
// (marked) and the last Column besides it. Open or not, a row is dragged by
// its grip (its left end, up to just before its name). The order changes
// here while dragging; `reordered` says a move is done, with the order
// before it.
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
  { delta: -1, icon: 'up', label: t.settings.moveUp, text: t.settings.moveUpText },
  { delta: 1, icon: 'down', label: t.settings.moveDown, text: t.settings.moveDownText },
] as const

// The open row, one at a time (#285).
const panelId = useId()
const openedId = ref<string | null>(null)
function toggle(column: ColumnRow) {
  openedId.value = openedId.value === column.id ? null : column.id
}

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
      class="row flex flex-col rounded-field bg-surface-muted"
      :class="{ lifted: drag?.id === column.id }"
      :style="drag?.id === column.id ? { translate: `0 ${drag.dy}px` } : undefined"
      :data-column-row="column.id"
    >
      <div class="flex">
        <!-- The grab area (#206): the row's whole left end, as high as the
             row, with the Column's accent dot in it, up to just before the
             name. Its click listener makes it a target of its own to
             Chrome's touch adjustment, which would otherwise move a finger
             near its end onto the row's button beside it. -->
        <span
          aria-hidden="true"
          data-grip
          class="grip flex shrink-0 cursor-grab items-center gap-2 pl-2.5 pr-2 text-text-muted"
          @pointerdown="lift(column, $event)"
          @click.stop
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
        <button
          type="button"
          class="toggle flex min-w-0 flex-1 items-center gap-3 py-3 pl-1 pr-3 text-left focus-visible:outline-2 focus-visible:outline-focus"
          :aria-expanded="openedId === column.id"
          :aria-controls="openedId === column.id ? `${panelId}-${column.id}` : undefined"
          @click="toggle(column)"
        >
          <span class="flex min-w-0 flex-1 flex-col">
            <span
              class="truncate font-display text-title-s text-text"
              data-column-name
            >{{ column.name }}</span>
            <span class="truncate font-display text-body-serif italic text-text-muted">{{ column.isGekocht ? t.board.gekochtSubtitle : column.subtitle ?? t.settings.subtitlePrompt }}</span>
          </span>
          <span
            aria-hidden="true"
            class="shrink-0 text-small text-text-muted"
            data-dish-count
          >{{ column.count }}</span>
          <span class="sr-only">{{ t.settings.dishCount(column.count) }}</span>
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            class="chevron shrink-0"
            :class="{ flipped: openedId === column.id }"
          ><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
      <div
        v-if="openedId === column.id"
        :id="`${panelId}-${column.id}`"
        class="panel flex flex-col gap-4 px-4 pb-4 pt-2"
      >
        <AppField
          :label="t.settings.columnNameLabel"
          :control-id="`${panelId}-${column.id}-name`"
        >
          <input
            :id="`${panelId}-${column.id}-name`"
            type="text"
            :value="column.name"
            :aria-label="t.settings.columnName(column.name)"
            required
            maxlength="40"
            autocomplete="off"
            class="font-display text-title-s"
            @change="rename(column, $event)"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          >
        </AppField>
        <AppField
          v-if="!column.isGekocht"
          :label="t.settings.subtitleLabel"
          :control-id="`${panelId}-${column.id}-subtitle`"
        >
          <input
            :id="`${panelId}-${column.id}-subtitle`"
            type="text"
            :value="column.subtitle ?? ''"
            :aria-label="t.settings.columnSubtitle(column.name)"
            :placeholder="t.settings.subtitlePrompt"
            maxlength="40"
            autocomplete="off"
            class="font-display italic"
            @change="setSubtitle(column, $event)"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          >
        </AppField>
        <p
          v-else
          class="text-small text-text-muted"
        >
          {{ t.settings.fixedSubtitle(t.board.gekochtSubtitle) }} · {{ t.settings.notDeletable }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="{ delta, icon, label, text } in STEPS"
            :key="delta"
            type="button"
            class="flex h-10 items-center gap-1.5 rounded-pill bg-surface px-4 text-small text-text transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-focus"
            :aria-label="label(column.name)"
            :disabled="!columns[index + delta]"
            :data-step="delta"
            @click="step(column, delta)"
          >
            <AppIcon
              :name="icon"
              :size="16"
            />
            {{ text }}
          </button>
          <button
            v-if="!column.isGekocht"
            type="button"
            class="danger-fill ml-auto flex h-10 items-center rounded-pill px-4 text-small transition-[scale,background-color] duration-tap ease-tap active:scale-95 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-focus"
            :aria-label="t.settings.deleteColumn(column.name)"
            :aria-describedby="deletable(column) ? undefined : lastHintId"
            :disabled="!deletable(column)"
            @click="emit('delete', column)"
          >
            {{ t.settings.deleteColumnText }}
          </button>
        </div>
      </div>
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
/* The rest of the row opens it: darker under a mouse, its chevron turning
   over while open. */
.toggle {
  border-radius: var(--radius-field);
  transition: background-color var(--dur-fade) var(--ease-fade);
}
@media (hover: hover) and (pointer: fine) {
  .toggle:hover {
    background-color: color-mix(in oklab, var(--color-text) 6%, transparent);
  }
}
.chevron {
  transition: rotate var(--dur-tap) var(--ease-tap);
}
.chevron.flipped {
  rotate: 180deg;
}
/* An open row's fields fade in while the rows below make room for them
   (settle, as `.row-move`), so those don't seem to slide over them. */
.panel {
  animation: panel-in var(--dur-settle) var(--ease-fade);
}
@keyframes panel-in {
  from {
    opacity: 0;
  }
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
