<script setup lang="ts">
import type { BoardSummary } from '~~/server/utils/boards'

// "Neues Board" (PRD story 61): a name and an emoji. The Board starts with
// the default Columns, owned by whoever creates it, and opens straight away,
// celebrating (BoardCreatedCelebration).
const open = defineModel<boolean>('open', { required: true })
const t = useStrings()

const name = ref('')
const emoji = ref('🍜')
const saving = ref(false)
const failed = ref(false)
const nameId = useId()
const justCreated = useJustCreatedBoard()

// Every opening starts from an empty form.
watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = ''
  emoji.value = '🍜'
  failed.value = false
})

async function create() {
  const trimmed = name.value.trim()
  if (!trimmed || saving.value) return
  saving.value = true
  failed.value = false
  try {
    const created = await $fetch<BoardSummary>('/api/boards', { method: 'POST', body: { name: trimmed, emoji: emoji.value } })
    open.value = false
    justCreated.value = created.id
    await navigateTo(`/b/${created.id}`)
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
    :title="t.boards.newBoard"
    :close-label="t.boards.close"
  >
    <form
      class="mt-5 flex flex-col gap-5"
      @submit.prevent="create"
    >
      <div class="flex flex-col gap-1.5">
        <label
          :for="nameId"
          class="text-label"
        >{{ t.boards.name }}</label>
        <input
          :id="nameId"
          v-model="name"
          type="text"
          required
          maxlength="60"
          autocomplete="off"
          :placeholder="t.boards.namePrompt"
          class="rounded-field border border-line-strong bg-surface px-4 py-field-display font-display text-title-s text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
      </div>
      <div class="flex flex-col gap-2">
        <span class="text-label">{{ t.boards.emoji }}</span>
        <EmojiPicker
          v-model="emoji"
          :label="t.boards.emoji"
        />
      </div>
      <p
        v-if="failed"
        role="alert"
        class="text-small text-danger"
      >
        {{ t.boards.failed }}
      </p>
      <!-- Creating, it shows its dots undimmed; create() ignores a second
           submit meanwhile. -->
      <button
        type="submit"
        class="rounded-pill bg-inverse px-5 py-3.5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        :disabled="!name.trim() && !saving"
        :aria-busy="saving"
      >
        <BusyLabel
          :label="t.boards.create"
          :busy-label="t.boards.creating"
          :busy="saving"
        />
      </button>
    </form>
  </AppSheet>
</template>
