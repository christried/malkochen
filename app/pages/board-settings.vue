<script setup lang="ts">
import type { BoardChanges, BoardMemberView, BoardNameAndEmoji, BoardView } from '~~/server/utils/boards'
import type { ColumnView } from '~~/server/utils/columns'
import type { ColumnRow } from '~/components/ColumnSettingsList.vue'
import { boardLabel } from '~~/shared/board'

// Board settings (PRD stories 57–60, 62–71), for any Member: the Board's name
// and emoji, its Columns, its Members, the Invite Link and leaving; for the
// Owner also removing Members, handing over ownership and deleting the Board.
// Its own page, not a child of the Board: any page under b/[id]/ opens over
// the Board (a route group doesn't help, it is nested all the same), so it
// lives here and sets its path. Every change saves at once; one that fails
// is put back and a notice says so.
definePageMeta({ path: '/b/:id/settings' })

const t = useStrings()
const route = useRoute()
const id = computed(() => String(route.params.id))

const { data: board, error, refresh } = await useFetch<BoardView>(() => `/api/boards/${id.value}`)
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusMessage, fatal: true })

useHead({ title: () => `${t.settings.title} · ${t.app.name}` })

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

// The Invite Link (PRD stories 62, 63, 66): any Member copies or shares it;
// only the Owner resets it, after confirming, since the old one then stops
// working wherever it was sent.
const origin = useRequestURL().origin
// Read from the Board itself, so a refetch never shows an old link.
const inviteLink = computed(() => `${origin}/invite/${board.value?.inviteToken ?? ''}`)

async function copyLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    toast.value = { text: t.settings.copied, duration: NOTICE_MS }
  }
  catch {
    failed()
  }
}

// The phone's share sheet, where the browser has one.
const canShare = ref(false)
onMounted(() => {
  canShare.value = typeof navigator.share === 'function'
})
async function shareLink() {
  const label = boardLabel(saved.value)
  try {
    await navigator.share({ title: label, text: t.settings.shareText(label), url: inviteLink.value })
  }
  catch (err) {
    // Closing the share sheet without sharing is no failure.
    if (!(err instanceof DOMException && err.name === 'AbortError')) failed()
  }
}

const confirmingReset = ref(false)
async function resetLink() {
  confirmingReset.value = false
  try {
    const reset = await $fetch<{ inviteToken: string }>(`/api/boards/${id.value}/invite/reset`, { method: 'POST' })
    // A new object: useFetch's data is a shallow ref.
    if (board.value) board.value = { ...board.value, inviteToken: reset.inviteToken }
    toast.value = { text: t.settings.resetDone, duration: NOTICE_MS }
  }
  catch {
    failed()
  }
}

// Members (PRD stories 67–71). The Owner picks a Member to hand ownership to
// or remove, then confirms; the list is fetched afresh either way, so it
// also shows what other Members changed meanwhile.
const members = computed(() => board.value?.members ?? [])
const managing = ref<BoardMemberView | null>(null)
const managingAction = ref<'hand-over' | 'remove' | null>(null)
const managingOpen = computed({
  get: () => managing.value !== null,
  set: (open) => {
    if (!open) managing.value = null
  },
})
function manage(member: BoardMemberView) {
  managingAction.value = null
  managing.value = member
}

async function changeMembers(request: () => Promise<unknown>, done: string) {
  managing.value = null
  try {
    await request()
    toast.value = { text: done, duration: NOTICE_MS }
  }
  catch {
    failed()
  }
  await refresh()
}
function handOver(member: BoardMemberView) {
  return changeMembers(
    () => $fetch<null>(`/api/boards/${id.value}/owner`, { method: 'POST', body: { userId: member.id } }),
    t.settings.handedOver(member.name),
  )
}
function removeMember(member: BoardMemberView) {
  return changeMembers(
    () => $fetch<null>(`/api/boards/${id.value}/members/${encodeURIComponent(member.id)}`, { method: 'DELETE' }),
    t.settings.removed(member.name),
  )
}

// Leaving (any Member but the Owner) and deleting (the Owner, after typing
// the Board's name) both end on the Board used last -- or a new "Meine
// Küche" for someone left on no Board at all.
const confirmingLeave = ref(false)
async function leave() {
  confirmingLeave.value = false
  const me = members.value.find(m => m.isYou)
  try {
    await $fetch<null>(`/api/boards/${id.value}/members/${encodeURIComponent(me?.id ?? '')}`, { method: 'DELETE' })
  }
  catch {
    failed()
    return
  }
  await navigateTo('/', { replace: true })
}

const confirmingDeleteBoard = ref(false)
const typedName = ref('')
watch(confirmingDeleteBoard, () => {
  typedName.value = ''
})
const nameTyped = computed(() => typedName.value.trim() === saved.value.name)
async function deleteBoard() {
  if (!nameTyped.value) return
  confirmingDeleteBoard.value = false
  try {
    await $fetch<null>(`/api/boards/${id.value}`, { method: 'DELETE' })
  }
  catch {
    failed()
    return
  }
  await navigateTo('/', { replace: true })
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
          {{ t.settings.title }}
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

      <section
        class="flex flex-col gap-3"
        aria-labelledby="settings-members"
      >
        <h2
          id="settings-members"
          class="px-1 text-overline uppercase text-text-muted"
        >
          {{ t.settings.members }}
        </h2>
        <MemberSettingsList
          :members="members"
          :is-owner="board.isOwner"
          @manage="manage"
        />
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="settings-invite"
      >
        <h2
          id="settings-invite"
          class="px-1 text-overline uppercase text-text-muted"
        >
          {{ t.settings.invite }}
        </h2>
        <div class="flex flex-col gap-1.5">
          <label
            for="settings-invite-link"
            class="text-label"
          >{{ t.settings.inviteLink }}</label>
          <input
            id="settings-invite-link"
            :value="inviteLink"
            type="text"
            readonly
            aria-describedby="settings-invite-hint"
            class="truncate rounded-field border border-line-strong bg-surface-muted px-4 py-3 text-body text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            @focus="($event.target as HTMLInputElement).select()"
          >
          <p
            id="settings-invite-hint"
            class="px-1 text-small text-text-muted"
          >
            {{ t.settings.inviteHint }}
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button
            v-if="canShare"
            type="button"
            class="rounded-pill bg-inverse px-5 py-3.5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            @click="shareLink"
          >
            {{ t.settings.shareLink }}
          </button>
          <button
            type="button"
            class="rounded-pill px-5 py-3.5 text-button transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            :class="canShare ? 'bg-surface-muted text-text' : 'bg-inverse text-on-inverse'"
            @click="copyLink"
          >
            {{ t.settings.copyLink }}
          </button>
          <DangerButton
            v-if="board.isOwner"
            @click="confirmingReset = true"
          >
            {{ t.settings.resetLink }}
          </DangerButton>
        </div>
      </section>

      <div class="flex flex-col items-start gap-3 border-t border-line pt-6">
        <template v-if="board.isOwner">
          <p class="px-1 text-small text-text-muted">
            {{ members.length > 1 ? t.settings.ownerLeaveHint : t.settings.aloneHint }}
          </p>
          <DangerButton @click="confirmingDeleteBoard = true">
            {{ t.settings.deleteBoard }}
          </DangerButton>
        </template>
        <DangerButton
          v-else
          @click="confirmingLeave = true"
        >
          {{ t.settings.leave }}
        </DangerButton>
      </div>
    </div>

    <AppSheet
      v-model:open="managingOpen"
      :title="managing ? (managingAction === 'hand-over' ? t.settings.handOverConfirm(managing.name) : managingAction === 'remove' ? t.settings.removeConfirm(managing.name) : managing.name) : ''"
      :close-label="t.settings.close"
    >
      <template v-if="managing">
        <p
          v-if="managingAction"
          class="mt-3 text-body text-text-muted"
        >
          {{ managingAction === 'hand-over' ? t.settings.handOverBody(managing.name) : t.settings.removeBody(managing.name) }}
        </p>
        <div class="mt-5 flex flex-col gap-2">
          <template v-if="!managingAction">
            <button
              type="button"
              class="rounded-pill bg-surface-muted px-5 py-3.5 text-button text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
              @click="managingAction = 'hand-over'"
            >
              {{ t.settings.handOver }}
            </button>
            <DangerButton @click="managingAction = 'remove'">
              {{ t.settings.removeMember }}
            </DangerButton>
          </template>
          <button
            v-else-if="managingAction === 'hand-over'"
            type="button"
            class="rounded-pill bg-inverse px-5 py-3.5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            @click="handOver(managing)"
          >
            {{ t.settings.handOver }}
          </button>
          <DangerButton
            v-else
            @click="removeMember(managing)"
          >
            {{ t.settings.removeMember }}
          </DangerButton>
          <button
            type="button"
            class="rounded-pill px-5 py-3 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
            @click="managing = null"
          >
            {{ t.settings.cancel }}
          </button>
        </div>
      </template>
    </AppSheet>

    <AppSheet
      v-model:open="confirmingLeave"
      :title="t.settings.leaveConfirm"
      :close-label="t.settings.close"
    >
      <p class="mt-3 text-body text-text-muted">
        {{ t.settings.leaveBody }}
      </p>
      <div class="mt-5 flex flex-col gap-2">
        <DangerButton @click="leave">
          {{ t.settings.leave }}
        </DangerButton>
        <button
          type="button"
          class="rounded-pill px-5 py-3 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          @click="confirmingLeave = false"
        >
          {{ t.settings.cancel }}
        </button>
      </div>
    </AppSheet>

    <AppSheet
      v-model:open="confirmingDeleteBoard"
      :title="t.settings.deleteConfirm"
      :close-label="t.settings.close"
    >
      <form
        class="mt-3 flex flex-col gap-2"
        @submit.prevent="deleteBoard"
      >
        <p class="text-body text-text-muted">
          {{ t.settings.deleteBody(boardLabel(saved)) }}
        </p>
        <label
          for="settings-delete-name"
          class="mt-3 text-label"
        >{{ t.settings.deleteTypeName(saved.name) }}</label>
        <input
          id="settings-delete-name"
          v-model="typedName"
          type="text"
          autocomplete="off"
          class="rounded-field border border-line-strong bg-surface px-4 py-3 text-body text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
        <DangerButton
          type="submit"
          class="mt-3 disabled:opacity-50"
          :disabled="!nameTyped"
        >
          {{ t.settings.deleteForGood }}
        </DangerButton>
        <button
          type="button"
          class="rounded-pill px-5 py-3 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          @click="confirmingDeleteBoard = false"
        >
          {{ t.settings.cancel }}
        </button>
      </form>
    </AppSheet>

    <AppSheet
      v-model:open="confirmingReset"
      :title="t.settings.resetConfirm"
      :close-label="t.settings.close"
    >
      <p class="mt-3 text-body text-text-muted">
        {{ t.settings.resetBody }}
      </p>
      <div class="mt-5 flex flex-col gap-2">
        <DangerButton @click="resetLink">
          {{ t.settings.resetLink }}
        </DangerButton>
        <button
          type="button"
          class="rounded-pill px-5 py-3 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          @click="confirmingReset = false"
        >
          {{ t.settings.cancel }}
        </button>
      </div>
    </AppSheet>

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
