<script setup lang="ts">
import type { CookingView } from '~~/server/utils/cookings'
import type { DishView } from '~~/server/utils/dishes'

// The small Cooking note sheet (PRD story 53), opened from the Gekocht
// toast or the Cooking History, for a Cooking of `dish`. A note is never
// required: an empty one removes it. Saved through the client Board module,
// so the Cooking History shows it.
const cooking = defineModel<CookingView | null>('cooking', { required: true })
const props = defineProps<{ dish: DishView | null }>()
const t = useStrings()
const boardModule = useBoardModule()
const noteId = useId()

const open = computed({
  get: () => cooking.value !== null,
  set: (isOpen) => {
    if (!isOpen) cooking.value = null
  },
})

const note = ref('')
const saving = ref(false)
const failed = ref(false)
const field = useTemplateRef<HTMLTextAreaElement>('field')
watch(cooking, async (shown) => {
  note.value = shown?.note ?? ''
  failed.value = false
  if (!shown) return
  await nextTick()
  field.value?.focus()
})

async function save() {
  const shown = cooking.value
  if (!shown || !props.dish || saving.value) return
  saving.value = true
  failed.value = false
  try {
    await boardModule.noteCooking(props.dish.id, shown.id, note.value)
    if (cooking.value === shown) cooking.value = null
  }
  catch {
    failed.value = true
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <AppSheet
    v-model:open="open"
    :title="t.cooking.noteHeading"
    :close-label="t.cooking.close"
  >
    <p class="mt-1 text-small text-text-muted">
      {{ dish?.title }}
    </p>
    <form
      class="mt-5 flex flex-col gap-4"
      @submit.prevent="save"
    >
      <AppField
        :label="t.cooking.note"
        :control-id="noteId"
      >
        <textarea
          :id="noteId"
          ref="field"
          v-model="note"
          maxlength="2000"
          :placeholder="t.cooking.notePrompt"
          class="font-display text-body-serif placeholder:font-ui placeholder:text-body"
        />
      </AppField>
      <p
        v-if="failed"
        role="alert"
        class="text-small text-danger"
      >
        {{ t.cooking.failed }}
      </p>
      <button
        type="submit"
        class="rounded-pill bg-inverse px-6 py-4 text-button-l text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        :aria-busy="saving"
      >
        <BusyLabel
          :label="t.cooking.save"
          :busy-label="t.cooking.saving"
          :busy="saving"
        />
      </button>
    </form>
  </AppSheet>
</template>
