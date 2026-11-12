<script setup lang="ts">
import { countShown, limitsOf, type Caret, type RecipeKind } from '~/utils/recipe-lines'

// One line of a Recipe in the editor (handoff RecipeLine, edit state): a grip
// to move it by, a Step's number, a text field that grows with its text, and
// a button to remove it. The editor (RecipeEditor) owns the lines and the
// rules of Enter, Backspace and pasting; this reports what was done to the
// field. Typing stops at the line's limit, and near it a counter says how
// much is left (never in the danger colour). The grip opens a menu with
// "Nach oben" and "Nach unten" for keyboard and screen reader users, and
// Alt+↑/↓ does the same; a pointer drags it (RecipeEditor).
const props = defineProps<{
  kind: RecipeKind
  // Where it stands in its list, from 0.
  index: number
  total: number
  // "Zutat 3", "Schritt 3": its field's name.
  label: string
  placeholder: string
  lifted: boolean
  // Let go of: it settles into its slot.
  dropping: boolean
  pasted: boolean
  menuOpen: boolean
}>()
const text = defineModel<string>({ required: true })
const emit = defineEmits<{
  enter: [caret: Caret]
  backspaceOnEmpty: []
  paste: [event: ClipboardEvent, caret: Caret]
  remove: []
  gripDown: [event: PointerEvent]
  toggleMenu: []
  closeMenu: []
  move: [delta: -1 | 1]
}>()
const t = useStrings()
const field = useTemplateRef<HTMLTextAreaElement>('field')
const grip = useTemplateRef<HTMLButtonElement>('grip')
const menu = useTemplateRef<HTMLElement>('menu')

const limit = computed(() => limitsOf(props.kind).characters)
const counted = computed(() => countShown('line', props.kind, text.value.length))
const atLimit = computed(() => text.value.length >= limit.value)
// What the grip and the remove button call the line: what it says (the
// start of it), or its field's name while it is empty.
const name = computed(() => {
  const said = text.value.trim()
  return said === '' ? props.label : said.length > 40 ? `${said.slice(0, 40)}…` : said
})
const helperId = useId()

const caret = (): Caret => ({ start: field.value?.selectionStart ?? 0, end: field.value?.selectionEnd ?? 0 })

// Enter (also a soft keyboard's, which says so in beforeinput) ends the line
// at the caret; Backspace on an empty one removes it.
function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    emit('move', event.key === 'ArrowUp' ? -1 : 1)
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    emit('enter', caret())
  }
  else if (event.key === 'Backspace' && text.value === '' && !event.repeat) {
    event.preventDefault()
    emit('backspaceOnEmpty')
  }
}
function onBeforeinput(event: InputEvent) {
  if (event.isComposing) return
  if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') {
    event.preventDefault()
    emit('enter', caret())
  }
  else if (event.inputType === 'deleteContentBackward' && text.value === '') {
    event.preventDefault()
    emit('backspaceOnEmpty')
  }
}
function onPaste(event: ClipboardEvent) {
  emit('paste', event, caret())
}

// Alt+↑/↓ on the grip too, and Escape closes its menu.
function onGripKeydown(event: KeyboardEvent) {
  if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    emit('move', event.key === 'ArrowUp' ? -1 : 1)
  }
}
function onMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('closeMenu')
    grip.value?.focus()
    return
  }
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
  event.preventDefault()
  const items = [...menu.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []]
  const at = items.indexOf(document.activeElement as HTMLButtonElement)
  items[(at + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
}
// Opened, the menu takes focus to its first item that works.
watch(() => props.menuOpen, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  menu.value?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
})

defineExpose({
  focus(at?: number) {
    const el = field.value
    if (!el) return
    el.focus({ preventScroll: true })
    const place = at === undefined ? el.value.length : Math.min(at, el.value.length)
    el.setSelectionRange(place, place)
    // Kept a little clear of the keyboard and the sheet's edge.
    el.scrollIntoView({ block: 'nearest' })
  },
  focusGrip() {
    grip.value?.focus()
  },
  gripButton: () => grip.value,
})

const iconButton = 'flex shrink-0 items-center justify-center text-text-muted transition-colors duration-tap ease-tap focus-visible:outline-2 focus-visible:outline-focus'
</script>

<template>
  <div
    class="line relative"
    :class="{ lifted, dropping, pasted }"
    :data-recipe-edit-line="kind"
  >
    <div class="row mx-1.5 flex items-start rounded-field">
      <button
        ref="grip"
        type="button"
        :class="iconButton"
        class="grip h-[52px] w-9 rounded-[14px] hover:text-text"
        :aria-label="t.recipe.moveLine(name)"
        aria-haspopup="menu"
        :aria-expanded="menuOpen"
        data-recipe-grip
        @pointerdown="emit('gripDown', $event)"
        @click="emit('toggleMenu')"
        @keydown="onGripKeydown"
      >
        <AppIcon
          name="grip"
          :size="16"
        />
      </button>
      <span
        v-if="kind === 'steps'"
        aria-hidden="true"
        class="step-number w-6 shrink-0 pt-[15px] font-display text-[17px] font-medium leading-none text-text-muted"
      >{{ index + 1 }}</span>
      <textarea
        ref="field"
        v-model="text"
        rows="1"
        class="field min-w-0 flex-1 resize-none bg-transparent py-[14px] text-[17px] font-medium leading-6 text-text outline-none placeholder:text-text-muted"
        :aria-label="label"
        :aria-describedby="counted ? helperId : undefined"
        :placeholder="placeholder"
        :maxlength="limit"
        enterkeyhint="next"
        autocomplete="off"
        autocapitalize="sentences"
        data-recipe-field
        @keydown="onKeydown"
        @beforeinput="onBeforeinput"
        @paste="onPaste"
      />
      <button
        type="button"
        :class="iconButton"
        class="h-[52px] w-[42px] hover:text-text"
        :aria-label="t.recipe.removeLine(name)"
        data-recipe-remove
        @click="emit('remove')"
      >
        <AppIcon
          name="close"
          :size="16"
        />
      </button>
      <!-- The keyboard and screen reader way to move a line. -->
      <div
        v-if="menuOpen"
        ref="menu"
        role="menu"
        class="menu absolute left-3 top-[58px] z-[6] flex w-[200px] flex-col rounded-[20px_18px_21px_19px] bg-surface p-1.5 shadow-dialog ring-1 ring-line"
        data-recipe-menu
        @keydown="onMenuKeydown"
      >
        <button
          type="button"
          role="menuitem"
          class="flex h-11 items-center gap-2.5 rounded-[14px] px-3 text-[15px] font-semibold text-text hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-35"
          :disabled="index === 0"
          data-recipe-move="up"
          @click="emit('move', -1)"
        >
          <AppIcon
            name="up"
            :size="17"
          />
          {{ t.recipe.moveUp }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex h-11 items-center gap-2.5 rounded-[14px] px-3 text-[15px] font-semibold text-text hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-35"
          :disabled="index === total - 1"
          data-recipe-move="down"
          @click="emit('move', 1)"
        >
          <AppIcon
            name="down"
            :size="17"
          />
          {{ t.recipe.moveDown }}
        </button>
      </div>
    </div>
    <!-- Near its limit a line counts its characters; at it, typing has
         stopped and a sentence says so. Calm, never in the danger colour. -->
    <div
      v-if="counted"
      class="flex gap-2.5 pb-2 pl-[50px] pr-[18px] pt-1.5 text-caption leading-4 text-text-muted"
    >
      <span class="min-w-0 flex-1 [text-wrap:pretty]">{{ atLimit ? (kind === 'ingredients' ? t.recipe.ingredientTooLong : t.recipe.stepTooLong) : '' }}</span>
      <span
        :id="helperId"
        class="shrink-0 tabular-nums"
        :class="{ 'text-text': atLimit }"
        data-recipe-char-count
      >{{ t.recipe.count(text.length, limit) }}</span>
    </div>
  </div>
</template>

<style scoped>
.field {
  field-sizing: content;
  min-height: 52px;
  overflow-wrap: anywhere;
  scroll-margin-block: 24px;
}
.grip {
  touch-action: none;
}
.row {
  transition: box-shadow var(--dur-fade) var(--ease-fade), background-color var(--dur-fade) var(--ease-fade);
}
.row:focus-within {
  background-color: var(--color-surface);
  box-shadow: inset 0 0 0 2px var(--color-text);
}
.row:has(.grip:focus-visible) {
  box-shadow: none;
  background-color: transparent;
}
/* Pasted lines are tinted, fading out over 1.6s. Reduced motion: the tint
   holds, and the editor takes it off after the same 1.6s. */
.pasted .row {
  animation: r13-tint 1600ms ease-out both;
}
@media (prefers-reduced-motion: reduce) {
  .pasted .row {
    animation: none;
    background-color: var(--color-paste-tint);
  }
}
/* A dragged line lifts like a Column in Board settings: a little larger,
   tilted, with the lift shadow and a surface fill. Reduced motion: no scale
   or tilt, a 2px text outline instead. */
.lifted .row {
  position: relative;
  z-index: 2;
  translate: 0 var(--row-dy, 0px);
  scale: 1.03;
  rotate: -1.5deg;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-lift);
  transition: scale var(--dur-lift) var(--ease-lift), rotate var(--dur-lift) var(--ease-lift);
}
.dropping:not(.lifted) .row {
  translate: 0 var(--row-dy, 0px);
}
.dropping .row {
  transition: translate var(--dur-drop-settle) var(--ease-settle), scale var(--dur-drop-settle) var(--ease-settle), rotate var(--dur-drop-settle) var(--ease-settle), box-shadow var(--dur-drop-settle) var(--ease-settle);
}
.lifted .grip {
  color: var(--color-text);
  cursor: grabbing;
}
@media (prefers-reduced-motion: reduce) {
  .lifted .row {
    scale: none;
    rotate: none;
    outline: 2px solid var(--color-text);
  }
}
.menu {
  animation: menu-in var(--dur-pop) var(--ease-pop);
  transform-origin: top left;
}
@keyframes menu-in {
  from { opacity: 0; scale: .92; }
}
</style>
