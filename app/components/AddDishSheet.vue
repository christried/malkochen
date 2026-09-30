<script setup lang="ts">
import type { DishView } from '~~/server/utils/dishes'
import { PLACEHOLDERS, type Placeholder } from '~~/shared/placeholders'

// Add Dish. For now only "Ohne Link hinzufügen": a title (required), an
// optional note and a Placeholder Image. Pasting a link comes with #6 and
// becomes this sheet's first step.
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ boardId: string }>()
const emit = defineEmits<{ added: [dish: DishView] }>()
const t = useStrings()

// "bowl" is the handoff's fallback Placeholder (illustrations.json autoPick).
const DEFAULT_PLACEHOLDER: Placeholder = 'bowl'

const title = ref('')
const note = ref('')
const placeholder = ref<Placeholder>(DEFAULT_PLACEHOLDER)
const choosingImage = ref(false)
const saving = ref(false)
const failed = ref(false)
const canSave = computed(() => title.value.trim() !== '' && !saving.value)

// The inline picker (handoff: 4×2) offers the first eight Placeholders; one
// chosen from the full picker ("Bild wählen") takes the last inline slot, so
// the selection is always in view.
const INLINE_COUNT = 8
const inlineOptions = computed<Placeholder[]>(() => {
  const first = PLACEHOLDERS.slice(0, INLINE_COUNT)
  return first.includes(placeholder.value) ? first : [...first.slice(0, -1), placeholder.value]
})
// In the full picker, arrow keys move the selection; tapping a tile (or
// Enter/Space on it) also closes the picker.
function closeOnTile(event: MouseEvent) {
  if ((event.target as Element).closest('[role="radio"]')) choosingImage.value = false
}

// Every opening starts from an empty form.
watch(open, (isOpen) => {
  if (!isOpen) return
  title.value = ''
  note.value = ''
  placeholder.value = DEFAULT_PLACEHOLDER
  failed.value = false
})

async function save() {
  if (!canSave.value) return
  saving.value = true
  failed.value = false
  try {
    const dish = await $fetch<DishView>(`/api/boards/${props.boardId}/dishes`, {
      method: 'POST',
      body: { title: title.value, note: note.value, placeholder: placeholder.value },
    })
    emit('added', dish)
    open.value = false
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
    :title="t.addDish.withoutLink"
    :close-label="t.addDish.close"
  >
    <form
      class="mt-5 flex flex-col gap-5"
      novalidate
      @submit.prevent="save"
    >
      <label class="flex flex-col gap-2">
        <span class="text-label">{{ t.addDish.title }}</span>
        <input
          v-model="title"
          type="text"
          required
          maxlength="200"
          autocomplete="off"
          :placeholder="t.addDish.titlePrompt"
          class="rounded-field border border-line-strong bg-surface px-4 py-3 font-display text-title-s text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
      </label>

      <label class="flex flex-col gap-2">
        <span class="text-label">{{ t.addDish.note }}</span>
        <textarea
          v-model="note"
          rows="2"
          maxlength="2000"
          :placeholder="t.addDish.notePrompt"
          class="resize-none rounded-field border border-line-strong bg-surface px-4 py-3 text-body text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
      </label>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-4">
          <span
            class="text-label"
            aria-hidden="true"
          >{{ t.addDish.image }}</span>
          <button
            type="button"
            class="rounded-pill bg-surface-muted px-3.5 py-2 text-label text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
            @click="choosingImage = true"
          >
            {{ t.addDish.chooseImage }}
          </button>
        </div>
        <PlaceholderPicker
          v-model="placeholder"
          :label="t.addDish.image"
          :options="inlineOptions"
        />
      </div>

      <p
        v-if="failed"
        role="alert"
        class="text-small text-danger"
      >
        {{ t.addDish.failed }}
      </p>

      <button
        type="submit"
        class="rounded-pill bg-inverse px-6 py-4 text-button-l text-on-inverse transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        :disabled="!canSave"
        :aria-busy="saving"
      >
        {{ saving ? t.addDish.saving : t.addDish.save }}
      </button>
    </form>

    <AppSheet
      v-model:open="choosingImage"
      :title="t.addDish.chooseImage"
      :close-label="t.addDish.close"
    >
      <PlaceholderPicker
        v-model="placeholder"
        class="mt-5"
        :label="t.addDish.chooseImage"
        @click="closeOnTile"
      />
    </AppSheet>
  </AppSheet>
</template>
