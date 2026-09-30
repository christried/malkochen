<script setup lang="ts">
import type { BoardChanges, BoardNameAndEmoji, BoardView } from '~~/server/utils/boards'
import type { ColumnView } from '~~/server/utils/columns'
import type { ColumnRow } from '~/components/ColumnSettingsList.vue'

// Board settings (PRD stories 57–60, 62), for any Member: the Board's name
// and emoji, and its Columns. Its own page, not a child of the Board (which
// is why the path is set here), so later tickets can add Members, the
// Invite Link and "Board verlassen" below. Every change saves at once; one
// that fails is put back and a notice says so.
definePageMeta({ path: '/b/:id/settings' })

const t = useStrings()
const route = useRoute()
const id = computed(() => String(route.params.id))

const { data: board, error, refresh } = await useFetch<BoardView>(() => `/api/boards/${id.value}`)
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusMessage, fatal: true })

useHead({ title: () => `${t.settings.heading} · ${t.app.name}` })

const name = ref(board.value?.name ?? '')
const emoji = ref(board.value?.emoji ?? '')
const rows = (view: BoardView | undefined): ColumnRow[] => view?.columns.map(c => ({ id: c.id, name: c.name, isGekocht: c.isGekocht, count: c.dishes.length })) ?? []
const columns = ref(rows(board.value))

const toast = ref<Toast | null>(null)
function failed() {
  toast.value = { text: t.settings.failed, duration: NOTICE_MS }
}

// The Board's name and emoji. A blank name puts the saved one back.
const saved = ref({ name: name.value, emoji: emoji.value })
async function saveBoard(changes: BoardChanges) {
  try {
    saved.value = await $fetch<BoardNameAndEmoji>(`/api/boards/${id.value}`, { method: 'PATCH', body: changes })
  }
  catch {
    failed()
  }
  name.value = saved.value.name
  emoji.value = saved.value.emoji
}
function saveName() {
  const trimmed = name.value.trim()
  if (!trimmed || trimmed === saved.value.name) name.value = saved.value.name
  else saveBoard({ name: trimmed })
}

const choosingEmoji = ref(false)
const emojiButton = useTemplateRef<HTMLButtonElement>('emojiButton')
watch(emoji, (chosen) => {
  if (!choosingEmoji.value || chosen === saved.value.emoji) return
  choosingEmoji.value = false
  saveBoard({ emoji: chosen })
})
watch(choosingEmoji, async (open) => {
  if (open) return
  await nextTick()
  emojiButton.value?.focus()
})

// Columns.
async function renameColumn(column: ColumnRow, newName: string) {
  const old = column.name
  column.name = newName
  try {
    await $fetch(`/api/columns/${column.id}`, { method: 'PATCH', body: { name: newName } })
  }
  catch {
    column.name = old
    failed()
  }
}

async function saveOrder(before: ColumnRow[]) {
  try {
    await $fetch(`/api/boards/${id.value}/columns`, { method: 'PUT', body: { columnIds: columns.value.map(c => c.id) } })
  }
  catch {
    columns.value = before
    failed()
  }
}

const newColumn = ref('')
const adding = ref(false)
async function addColumn() {
  const trimmed = newColumn.value.trim()
  if (!trimmed || adding.value) return
  adding.value = true
  try {
    const added = await $fetch<ColumnView>(`/api/boards/${id.value}/columns`, { method: 'POST', body: { name: trimmed } })
    columns.value.push({ ...added, count: 0 })
    newColumn.value = ''
  }
  catch {
    failed()
  }
  finally {
    adding.value = false
  }
}

// Deleting: an empty Column goes at once (PRD story 59); one with Dishes
// first asks where they go (story 58), the first Column chosen that isn't
// Gekocht, where new Dishes go too.
const deleting = ref<ColumnRow | null>(null)
const deletingOpen = computed({
  get: () => deleting.value !== null,
  set: (open) => {
    if (!open) deleting.value = null
  },
})
const targets = computed(() => columns.value.filter(c => c !== deleting.value))
const moveTo = ref<string>()

function askDelete(column: ColumnRow) {
  if (column.count === 0) return deleteColumn(column)
  const others = columns.value.filter(c => c !== column)
  moveTo.value = (others.find(c => !c.isGekocht) ?? others[0])?.id
  deleting.value = column
}

async function deleteColumn(column: ColumnRow, target?: ColumnRow) {
  const before = columns.value
  columns.value = columns.value.filter(c => c !== column)
  if (target) target.count += column.count
  deleting.value = null
  try {
    await $fetch(`/api/columns/${column.id}`, { method: 'DELETE', query: target && { moveTo: target.id } })
  }
  catch {
    if (target) target.count -= column.count
    columns.value = before
    if (target || !await gotDishes(column)) failed()
  }
}

// A Column that looked empty may have got Dishes meanwhile (another Member
// added some): with the counts fetched afresh, it asks where they go after all.
async function gotDishes(column: ColumnRow): Promise<boolean> {
  await refresh()
  columns.value = rows(board.value)
  const fresh = columns.value.find(c => c.id === column.id)
  if (!fresh?.count) return false
  askDelete(fresh)
  return true
}

function confirmDelete() {
  const column = deleting.value
  const target = columns.value.find(c => c.id === moveTo.value)
  if (column && target) deleteColumn(column, target)
}
</script>

<template>
  <main
    v-if="board"
    class="min-h-dvh bg-bg px-4 pb-32 pt-6 text-text tablet:px-10"
  >
    <div class="mx-auto flex max-w-[560px] flex-col gap-8">
      <header class="flex items-center gap-3">
        <NuxtLink
          :to="`/b/${board.id}`"
          :aria-label="t.settings.back"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        >
          <AppIcon
            name="back"
            :size="20"
          />
        </NuxtLink>
        <h1 class="font-display text-title-l tablet:text-display-m">
          {{ t.settings.heading }}
        </h1>
      </header>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="settings-board"
      >
        <h2
          id="settings-board"
          class="px-1 text-overline uppercase text-text-muted"
        >
          {{ t.settings.board }}
        </h2>
        <div class="flex items-end gap-3">
          <button
            ref="emojiButton"
            type="button"
            class="emoji-pebble flex h-[52px] w-[52px] shrink-0 items-center justify-center bg-surface-muted text-[28px] transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
            :aria-label="t.settings.emoji"
            aria-haspopup="dialog"
            @click="choosingEmoji = true"
          >
            {{ emoji }}
          </button>
          <div class="flex flex-1 flex-col gap-1.5">
            <label
              for="settings-name"
              class="text-label"
            >{{ t.settings.name }}</label>
            <input
              id="settings-name"
              v-model="name"
              type="text"
              required
              maxlength="60"
              autocomplete="off"
              class="rounded-field border border-line-strong bg-surface px-4 py-3 font-display text-title-s text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              @change="saveName"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            >
          </div>
        </div>
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="settings-columns"
      >
        <h2
          id="settings-columns"
          class="px-1 text-overline uppercase text-text-muted"
        >
          {{ t.settings.columns }}
        </h2>
        <ColumnSettingsList
          v-model="columns"
          @rename="renameColumn"
          @reordered="saveOrder"
          @delete="askDelete"
        />
        <form
          class="mt-2 flex items-end gap-3"
          @submit.prevent="addColumn"
        >
          <div class="flex flex-1 flex-col gap-1.5">
            <label
              for="settings-new-column"
              class="text-label"
            >{{ t.settings.newColumn }}</label>
            <input
              id="settings-new-column"
              v-model="newColumn"
              type="text"
              maxlength="40"
              autocomplete="off"
              :placeholder="t.settings.newColumnPrompt"
              class="rounded-field border border-line-strong bg-surface px-4 py-3 text-body text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
          </div>
          <button
            type="submit"
            class="rounded-pill bg-inverse px-5 py-3.5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            :disabled="!newColumn.trim() || adding"
          >
            {{ t.settings.add }}
          </button>
        </form>
      </section>
    </div>

    <AppSheet
      v-model:open="choosingEmoji"
      :title="t.settings.chooseEmoji"
      :close-label="t.settings.close"
    >
      <EmojiPicker
        v-model="emoji"
        class="mt-5"
        :label="t.settings.chooseEmoji"
      />
    </AppSheet>

    <AppSheet
      v-model:open="deletingOpen"
      :title="deleting ? t.settings.moveDishes(deleting.count, deleting.name) : ''"
      :close-label="t.settings.close"
    >
      <form
        class="mt-5 flex flex-col gap-2"
        @submit.prevent="confirmDelete"
      >
        <label
          v-for="target in targets"
          :key="target.id"
          class="flex cursor-pointer items-center gap-3 rounded-field bg-surface-muted px-5 py-3.5 text-button has-[:checked]:ring-2 has-[:checked]:ring-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus"
        >
          <input
            v-model="moveTo"
            type="radio"
            name="move-to"
            class="h-4 w-4 accent-[var(--color-text)]"
            :value="target.id"
          >
          {{ target.name }}
        </label>
        <DangerButton
          type="submit"
          class="mt-3"
        >
          {{ t.settings.moveAndDelete }}
        </DangerButton>
        <button
          type="button"
          class="rounded-pill px-5 py-3 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          @click="deleting = null"
        >
          {{ t.settings.cancel }}
        </button>
      </form>
    </AppSheet>

    <AppToast v-model="toast" />
  </main>
</template>

<style scoped>
/* The Board's emoji sits in a pebble, like the Board switcher's rows. */
.emoji-pebble {
  border-radius: var(--radius-blob);
}
</style>
