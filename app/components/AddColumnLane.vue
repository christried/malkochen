<script setup lang="ts">
// The add lane (handoff tokens.json → breakpoints.desktop: "Kanban lanes +
// add-Column lane"), desktop only, after the last Column: a dashed outline
// (handoff Button "dashed (add)") saying "Neue Spalte". Clicked, it turns
// into the new Column's name field (label style 5b) with a round add
// button, as in Board settings and by the same rules (useNewColumn). Enter
// or the button adds the Column at the end of the Board, through the Board
// module, and the lane rests again. Escape, or clicking away from an empty
// field, turns it back too. Tablets and phones add Columns in Board settings.
const emit = defineEmits<{ failed: [] }>()

const t = useStrings()
const boardModule = useBoardModule()
const { name, adding, canAdd, submit } = useNewColumn(columnName => boardModule.addColumn(columnName), () => emit('failed'))
// The name field's made-up example, a new one each time the lane opens.
const nameExample = useExamplePrompt(() => t.settings.newColumnExamples, example => t.settings.newColumnPrompt(example))

const open = ref(false)
const form = useTemplateRef<HTMLFormElement>('form')
const field = useTemplateRef<HTMLInputElement>('field')
const opener = useTemplateRef<HTMLButtonElement>('opener')

async function start() {
  nameExample.pickAnother()
  open.value = true
  await nextTick()
  field.value?.focus()
}

// Back to rest, the field emptied; focus on the lane again unless it went
// elsewhere (`refocus: false`).
async function rest({ refocus = true } = {}) {
  name.value = ''
  open.value = false
  if (!refocus) return
  await nextTick()
  opener.value?.focus()
}

// While the Column is being added, the name can't change and the lane stays
// open, so what the server adds is what the field shows. If it fails, the
// name stays for another try, focused (the add button is disabled
// meanwhile, which drops focus).
async function add() {
  if (await submit()) await rest()
  else field.value?.focus()
}

function escape() {
  if (!adding.value) void rest()
}

// Clicking (or tabbing) away from the empty field; not to its own button.
function leave(event: FocusEvent) {
  if (adding.value || name.value.trim() || form.value?.contains(event.relatedTarget as Node | null)) return
  void rest({ refocus: false })
}
</script>

<template>
  <div class="add-lane w-[330px] shrink-0 snap-start rounded-panel">
    <button
      v-if="!open"
      ref="opener"
      type="button"
      class="flex min-h-24 w-full items-center gap-3 rounded-panel px-5 py-4 text-left font-display text-title-s text-text-muted transition-[scale,color,background-color] duration-tap ease-tap hover:bg-surface-muted/50 hover:text-text active:scale-[.98] focus-visible:outline-2 focus-visible:outline-focus"
      @click="start"
    >
      <AppIcon
        name="plus"
        :size="22"
      />
      {{ t.settings.newColumn }}
    </button>
    <!-- The label is in the field's border, so the button centres on the
         field (handoff Input "withButton"), as in Board settings. -->
    <form
      v-else
      ref="form"
      class="flex min-h-24 items-end gap-2.5 p-4"
      @submit.prevent="add"
      @keydown.esc.prevent="escape"
      @focusout="leave"
    >
      <AppField
        class="flex-1"
        :label="t.settings.newColumn"
        control-id="board-new-column"
      >
        <input
          id="board-new-column"
          ref="field"
          v-model="name"
          type="text"
          maxlength="40"
          autocomplete="off"
          :readonly="adding"
          :placeholder="nameExample.prompt.value"
        >
      </AppField>
      <button
        type="submit"
        class="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-inverse text-on-inverse transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        :aria-label="t.settings.add"
        :data-tooltip="t.settings.add"
        :disabled="!canAdd"
      >
        <AppIcon
          name="plus"
          :size="20"
        />
      </button>
    </form>
  </div>
</template>

<style scoped>
/* The handoff's dashed outline, as a dragged card's place (2.5px, the text
   at 25%), stronger on hover. */
.add-lane {
  border: 2.5px dashed color-mix(in srgb, var(--color-text) 25%, transparent);
  transition: border-color var(--dur-fade) var(--ease-fade);
}
.add-lane:hover {
  border-color: color-mix(in srgb, var(--color-text) 40%, transparent);
}
</style>
