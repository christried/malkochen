<script setup lang="ts">
import { SHOPPING_LIMITS } from '~~/shared/shopping-list'

// The Shopping List's text field in two variants (#536). "add" types items
// into "Sonstiges": v-model is the draft, Enter submits, and the parent
// refocuses the field through the exposed focus() so several go in a row.
// "edit" changes a line's text in place: it starts from the line's text and
// keeps its own copy while typing, saves on submit, and cancels on Escape or
// the cross. The edit field takes the focus when it appears.
const props = defineProps<{
  variant: 'add' | 'edit'
  text?: string
}>()
const emit = defineEmits<{
  submit: []
  save: [text: string]
  cancel: []
}>()

const t = useStrings()
const draft = defineModel<string>({ default: '' })
const edited = ref(props.text ?? '')

const field = useTemplateRef<HTMLInputElement>('field')
const fieldId = useId()
function focus() {
  field.value?.focus({ preventScroll: true })
}
function blur() {
  field.value?.blur()
}
defineExpose({ focus, blur })

onMounted(() => {
  if (props.variant === 'edit') field.value?.focus()
})
</script>

<template>
  <!-- The phone's add bar and the desktop field are both this form; the
       parent places it (the bar docked on the keyboard, or the Sonstiges
       column's end). The label sits in the border (AppField). The "+" is
       for phones: on desktop Enter is the way in, and "↵" shows the key. -->
  <form
    v-if="variant === 'add'"
    class="flex items-center gap-2"
    @submit.prevent="emit('submit')"
  >
    <AppField
      :label="t.shopping.addLabel"
      :control-id="fieldId"
      class="min-w-0 flex-1"
    >
      <input
        :id="fieldId"
        ref="field"
        v-model="draft"
        type="text"
        enterkeyhint="next"
        autocomplete="off"
        :maxlength="SHOPPING_LIMITS.characters"
        :placeholder="t.shopping.addPlaceholder"
        class="h-12 w-full px-4 text-body outline-none placeholder:text-text-muted"
        data-shopping-add
      >
      <span
        class="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 text-[15px] text-text-muted desktop:block"
        aria-hidden="true"
      >↵</span>
    </AppField>
    <button
      type="submit"
      class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-inverse text-on-inverse transition-[transform,opacity] duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus desktop:hidden"
      :class="{ 'opacity-[.35]': !draft.trim() }"
      :aria-label="t.shopping.add"
      @pointerdown.prevent
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
    @submit.prevent="emit('save', edited)"
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
        @keydown.esc.prevent="emit('cancel')"
      >
    </label>
    <button
      type="submit"
      class="h-11 shrink-0 rounded-pill bg-inverse px-4 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {{ t.shopping.save }}
    </button>
    <button
      type="button"
      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
      :aria-label="t.shopping.cancel"
      @click="emit('cancel')"
    >
      <AppIcon name="close" />
    </button>
  </form>
</template>
