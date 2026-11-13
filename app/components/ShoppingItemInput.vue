<script setup lang="ts">
import { SHOPPING_LIMITS } from '~~/shared/shopping-list'

// The Shopping List's text field in two variants (#536, R15). "add" types
// items into "Sonstiges": v-model is the draft, Enter submits, and the parent
// refocuses the field through the exposed focus() so several go in a row.
// "edit" changes a line's text in place (R15): it starts from the line's text,
// its text selected, and keeps its own copy while typing. Enter or leaving the
// field saves; an empty text removes the line instead; Escape cancels. The
// delete button in the field removes the line. The edit field takes the focus
// when it appears.
const props = defineProps<{
  variant: 'add' | 'edit'
  text?: string
}>()
const emit = defineEmits<{
  submit: []
  save: [text: string]
  cancel: []
  remove: []
}>()

const t = useStrings()
const draft = defineModel<string>({ default: '' })
const edited = ref(props.text ?? '')
// Once the field has saved, cancelled or removed, what comes after (its blur,
// say) is ignored.
let settled = false

const field = useTemplateRef<HTMLInputElement>('field')
function focus() {
  field.value?.focus({ preventScroll: true })
}
defineExpose({ focus })

onMounted(() => {
  if (props.variant !== 'edit') return
  field.value?.focus()
  field.value?.select()
})

function finish() {
  if (settled) return
  settled = true
  if (edited.value.trim() === '') emit('remove')
  else emit('save', edited.value)
}

function cancel() {
  if (settled) return
  settled = true
  emit('cancel')
}

function remove() {
  if (settled) return
  settled = true
  emit('remove')
}
</script>

<template>
  <form
    v-if="variant === 'add'"
    class="mt-3 flex items-center gap-2"
    @submit.prevent="emit('submit')"
  >
    <label class="min-w-0 flex-1">
      <span class="sr-only">{{ t.shopping.addLabel }}</span>
      <input
        ref="field"
        v-model="draft"
        type="text"
        enterkeyhint="done"
        autocomplete="off"
        :maxlength="SHOPPING_LIMITS.characters"
        :placeholder="t.shopping.addPlaceholder"
        class="h-12 w-full rounded-pill bg-surface px-5 text-body shadow-small outline-none placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
        data-shopping-add
      >
    </label>
    <button
      type="submit"
      class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-inverse text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      :aria-label="t.shopping.add"
    >
      <AppIcon
        name="plus"
        :size="20"
      />
    </button>
  </form>
  <form
    v-else
    class="flex min-h-14 flex-1 items-center gap-2 px-2"
    @submit.prevent="finish"
  >
    <label class="min-w-0 flex-1">
      <span class="sr-only">{{ t.shopping.editLabel }}</span>
      <input
        ref="field"
        v-model="edited"
        type="text"
        enterkeyhint="done"
        autocomplete="off"
        :maxlength="SHOPPING_LIMITS.characters"
        class="h-11 w-full rounded-pill bg-surface-muted px-4 text-body outline-none focus-visible:outline-2 focus-visible:outline-focus"
        data-shopping-edit
        @keydown.esc.prevent="cancel"
        @blur="finish"
      >
    </label>
    <!-- Pressing the button must not blur the field first (that would save): the press is kept, the click removes. -->
    <button
      type="button"
      class="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-swipe-danger text-on-swipe-danger transition-transform duration-tap ease-tap active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      :aria-label="t.shopping.remove(text ?? '')"
      data-shopping-remove
      @pointerdown.prevent
      @mousedown.prevent
      @click="remove"
    >
      <AppIcon
        name="trash"
        :size="18"
      />
    </button>
  </form>
</template>
