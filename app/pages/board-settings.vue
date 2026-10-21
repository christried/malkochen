<script setup lang="ts">
import type { BoardChanges, BoardMemberView, BoardNameAndEmoji, BoardView } from '~~/server/utils/boards'
import type { ArchivedDishView, PlacedDish } from '~~/server/utils/dishes'
import type { ColumnRow } from '~/components/ColumnSettingsList.vue'
import { isRefused } from '~/board/board-module'
import { postColumn } from '~/board/http-transport'
import { boardPath } from '~~/shared/address'
import { boardLabel } from '~~/shared/board'
import { invitePath } from '~~/shared/invite'
import { viewerMay, type Permission, type Permissions } from '~~/shared/permissions'
import { columnDeletion } from '~~/shared/placement'

// Board settings (PRD stories 57–60, 62–71), for any Member: the Board's name
// and emoji, its Columns, its Members, the Invite Link, its Archive and
// leaving; for the Owner also each Member's Permissions and the Default
// Permissions, removing Members, handing over ownership,
// deleting Archived Dishes for good and deleting the Board. What a Member's
// Permissions don't allow is shown without a way to change it (the name,
// emoji and Columns), or not at all (adding a Column, the Invite Link).
// Its own page, not a child of the Board: any page under b/[board]/ opens over
// the Board (a route group doesn't help, it is nested all the same), so it
// lives here and sets its path. Every change saves at once; one that fails
// is put back and a notice says so.
definePageMeta({ path: '/b/:board/settings' })

const t = useStrings()

// The Board at this address; an outdated one forwards (useBoardAddress).
const boardId = (await useBoardAddress('/settings'))?.boardId ?? null
const id = computed(() => boardId ?? '')

const { data: board, error, refresh } = await useFetch<BoardView>(() => `/api/boards/${id.value}`, { immediate: boardId !== null })
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusMessage, fatal: true })

useHead({ title: () => `${t.settings.title} · ${t.app.name}` })

const name = ref(board.value?.name ?? '')
const emoji = ref(board.value?.emoji ?? '')
const rows = (view: BoardView | undefined): ColumnRow[] => view?.columns.map(c => ({ id: c.id, name: c.name, subtitle: c.subtitle, isGekocht: c.isGekocht, count: c.dishes.length })) ?? []
const columns = ref(rows(board.value))

// What the user may change here (their Permissions as the page loaded).
const mayEditBoard = computed(() => board.value?.permissions.editBoard ?? false)
const mayEditColumns = computed(() => board.value?.permissions.editColumns ?? false)

const toast = ref<Toast | null>(null)
// A change refused for the user's Permissions (the Owner just switched one
// off) says so.
function failed(error?: unknown) {
  toast.value = { text: isRefused(error) ? t.settings.notAllowed : t.settings.failed, duration: NOTICE_MS }
}
// A change the user's Permissions don't allow is refused here, as the
// server would, before it shows: true if so, with the notice.
function notPermitted(permission: Permission): boolean {
  if (board.value?.permissions[permission]) return false
  toast.value = { text: t.settings.notAllowed, duration: NOTICE_MS }
  return true
}

// The Board's name and emoji, and its Address, which follows a new name.
// A blank name puts the saved one back.
const saved = ref({ name: name.value, emoji: emoji.value, slug: board.value?.slug ?? '' })
async function saveBoard(changes: BoardChanges) {
  if (notPermitted('editBoard')) {
    name.value = saved.value.name
    emoji.value = saved.value.emoji
    return
  }
  try {
    saved.value = await $fetch<BoardNameAndEmoji>(`/api/boards/${id.value}`, { method: 'PATCH', body: changes })
  }
  catch (error) {
    failed(error)
  }
  name.value = saved.value.name
  emoji.value = saved.value.emoji
}
useEscapeToLeave(() => boardPath(saved.value))
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
  if (notPermitted('editColumns')) return
  const old = column.name
  column.name = newName
  try {
    await $fetch(`/api/columns/${column.id}`, { method: 'PATCH', body: { name: newName } })
  }
  catch (error) {
    column.name = old
    failed(error)
  }
}

// A Column Subtitle; null clears it.
async function setColumnSubtitle(column: ColumnRow, subtitle: string | null) {
  if (notPermitted('editColumns')) return
  const old = column.subtitle
  column.subtitle = subtitle
  try {
    await $fetch(`/api/columns/${column.id}`, { method: 'PATCH', body: { subtitle } })
  }
  catch (error) {
    column.subtitle = old
    failed(error)
  }
}

async function saveOrder(before: ColumnRow[]) {
  if (notPermitted('editColumns')) {
    columns.value = before
    return
  }
  try {
    await $fetch(`/api/boards/${id.value}/columns`, { method: 'PUT', body: { columnIds: columns.value.map(c => c.id) } })
  }
  catch (error) {
    columns.value = before
    failed(error)
  }
}

// A new Column, at the end; the same as the Board's add lane on desktop. Its
// name field's made-up example is a new one each time the page opens, and
// once a Column is added.
const newColumnExample = useExamplePrompt(() => t.settings.newColumnExamples, example => t.settings.newColumnPrompt(example))
onMounted(newColumnExample.pickAnother)
const { name: newColumn, canAdd: canAddColumn, submit: addColumn } = useNewColumn(async (columnName) => {
  if (notPermitted('editColumns')) return
  const added = await postColumn(id.value, columnName)
  columns.value.push({ ...added, count: 0 })
  newColumnExample.pickAnother()
}, failed)

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
  if (notPermitted('editColumns')) return
  if (column.count === 0) return deleteColumn(column)
  // The Column the server picks by default. If it can't be deleted after
  // all (changed meanwhile), any other: the server then says why.
  const planned = columnDeletion(columns.value, column)
  moveTo.value = 'target' in planned ? planned.target.id : columns.value.find(c => c !== column)?.id
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
  catch (error) {
    if (target) target.count -= column.count
    columns.value = before
    if (target || !await gotDishes(column)) failed(error)
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

// The Invite Link (PRD stories 62, 63, 66): any Member with "share the
// Invite Link" copies or shares it (the others never get it, so the
// section isn't there); only the Owner resets it, after confirming, since
// the old one then stops working wherever it was sent.
const origin = useRequestURL().origin
// The secret read from the Board itself, so a refetch never shows an old
// link; the slug follows a new name (any slug works: only the secret counts).
const inviteLink = computed(() => `${origin}${invitePath({ slug: saved.value.slug, inviteToken: board.value?.inviteToken ?? '' })}`)

// Copied, the button says so for a moment (handoff Button "success flip":
// its label rolls up and out, "Kopiert ✓" pops in, five pebbles burst),
// and the Toast says it for screen readers too.
const COPIED_MS = 1600
const { shot: copied, fire: flipCopied, clear: unflipCopied } = useOneShot<true>()
let copiedEnd: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(copiedEnd))
async function copyLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    toast.value = { text: t.settings.copied, duration: NOTICE_MS }
    hapticConfirm()
    flipCopied(true)
    clearTimeout(copiedEnd)
    copiedEnd = setTimeout(unflipCopied, COPIED_MS)
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
const selectedMember = ref<BoardMemberView | null>(null)
const memberAction = ref<'hand-over' | 'remove' | null>(null)
const memberSheetOpen = computed({
  get: () => selectedMember.value !== null,
  set: (open) => {
    if (!open) selectedMember.value = null
  },
})
// The Member's name, until the Owner picks what to do; then the question.
const memberSheetTitle = computed(() => {
  const name = selectedMember.value?.name ?? ''
  if (memberAction.value === 'hand-over') return t.settings.handOverConfirm(name)
  if (memberAction.value === 'remove') return t.settings.removeConfirm(name)
  return name
})
function manage(member: BoardMemberView) {
  memberAction.value = null
  selectedMember.value = member
}

async function changeMembers(request: () => Promise<unknown>, done: string) {
  selectedMember.value = null
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

// Permissions (#340, #343): in a Member's sheet the Owner switches each
// one, or all but commenting and voting off ("Nur ansehen"), and the same
// for the Default Permissions, which a Member joining gets. Saved at once;
// one that fails stays as it was, with a notice. The Member's open Board
// follows at its next check. Every other Member sees their own, read-only.
type PermissionsBusy = Permission | 'viewOnly' | null
const switchingPermission = ref<PermissionsBusy>(null)
const switchingDefault = ref<PermissionsBusy>(null)
// The Permissions saved at `path`, or null if that failed.
async function savePermissions(path: string, changes: Partial<Permissions>, busy: Ref<PermissionsBusy>, what: Exclude<PermissionsBusy, null>): Promise<Permissions | null> {
  if (busy.value) return null
  busy.value = what
  try {
    return await $fetch<Permissions>(path, { method: 'PATCH', body: changes })
  }
  catch {
    failed()
    return null
  }
  finally {
    busy.value = null
  }
}
async function switchPermissions(member: BoardMemberView, changes: Partial<Permissions>, what: Exclude<PermissionsBusy, null>) {
  if (!member.permissions) return
  const saved = await savePermissions(`/api/boards/${id.value}/members/${encodeURIComponent(member.id)}/permissions`, changes, switchingPermission, what)
  if (saved) member.permissions = saved
}
async function switchDefaults(changes: Partial<Permissions>, what: Exclude<PermissionsBusy, null>) {
  const saved = await savePermissions(`/api/boards/${id.value}/default-permissions`, changes, switchingDefault, what)
  // A new object: useFetch's data is a shallow ref.
  if (saved && board.value) board.value = { ...board.value, defaultPermissions: saved }
}

// Leaving (any Member but the Owner) and deleting (the Owner, after typing
// the Board's name) both end on the Board used last -- or a new "Meine
// Küche" for someone left on no Board at all.
async function goOffBoard(request: () => Promise<unknown>) {
  try {
    await request()
  }
  catch {
    failed()
    return
  }
  await navigateTo('/', { replace: true })
}

const confirmingLeave = ref(false)
function leave() {
  confirmingLeave.value = false
  const me = members.value.find(m => m.isYou)
  if (!me) return
  return goOffBoard(() => $fetch<null>(`/api/boards/${id.value}/members/${encodeURIComponent(me.id)}`, { method: 'DELETE' }))
}

const confirmingDeleteBoard = ref(false)
const typedName = ref('')
watch(confirmingDeleteBoard, () => {
  typedName.value = ''
})
const nameTyped = computed(() => confirmsDeletion(typedName.value, saved.value.name))
function deleteBoard() {
  if (!nameTyped.value) return
  hapticReject()
  confirmingDeleteBoard.value = false
  return goOffBoard(() => $fetch<null>(`/api/boards/${id.value}`, { method: 'DELETE' }))
}

// The Board's Archive (#336; CONTEXT.md: Archived Dish). Fetched apart from
// the Board and not awaited, so it never holds the page up; it shows once
// it is there. Restoring takes a Dish off the list at once and puts it back
// on the Board, where its Column counts it again; deleting one for good
// (the Owner) asks first. One that fails fetches the Archive afresh, which
// also shows what other Members did meanwhile.
const { data: archive, refresh: refreshArchive } = useFetch<{ dishes: ArchivedDishView[] }>(
  () => `/api/boards/${id.value}/archive`,
  { immediate: boardId !== null, lazy: true },
)
// Takes the Dish off the Archive's list.
function offArchive(dish: ArchivedDishView) {
  // A new object: useFetch's data is a shallow ref.
  if (archive.value) archive.value = { dishes: archive.value.dishes.filter(d => d.id !== dish.id) }
}

// Restoring needs "archive Dishes", as archiving does, or that the user
// added the Dish.
function mayRestore(dish: ArchivedDishView) {
  return !!board.value && viewerMay(board.value, 'archiveDishes', { addedBy: dish.addedById })
}

async function restoreArchived(dish: ArchivedDishView) {
  offArchive(dish)
  try {
    const restored = await $fetch<PlacedDish>(`/api/dishes/${dish.id}/restore`, { method: 'POST' })
    const column = columns.value.find(c => c.id === restored.placement.columnId)
    if (column) column.count += 1
    toast.value = { text: t.settings.restored(dish.title), duration: NOTICE_MS }
  }
  catch (error) {
    // Refused for the user's Permissions (the Owner just took "archive
    // Dishes" away): it says so.
    if (isRefused(error)) toast.value = { text: t.dish.notAllowed(dish.title), duration: NOTICE_MS }
    else failed()
    await refreshArchive()
  }
}

const purging = ref<ArchivedDishView | null>(null)
const purgingOpen = computed({
  get: () => purging.value !== null,
  set: (open) => {
    if (!open) purging.value = null
  },
})
async function purgeArchived() {
  const dish = purging.value
  if (!dish) return
  purging.value = null
  hapticReject()
  offArchive(dish)
  try {
    await $fetch<null>(`/api/dishes/${dish.id}/purge`, { method: 'POST' })
    toast.value = { text: t.settings.purged(dish.title), duration: NOTICE_MS }
  }
  catch {
    failed()
    await refreshArchive()
  }
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
          :to="boardPath(saved)"
          :aria-label="t.settings.back"
          :data-tooltip="t.settings.back"
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
          class="section-heading px-1"
        >
          {{ t.settings.board }}
        </h2>
        <div class="flex items-end gap-3">
          <button
            v-if="mayEditBoard"
            ref="emojiButton"
            type="button"
            class="emoji-pebble hover-grow flex h-[52px] w-[52px] shrink-0 items-center justify-center bg-surface-muted text-[28px] transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
            :aria-label="t.settings.emoji"
            :data-tooltip="t.settings.emoji"
            aria-haspopup="dialog"
            @click="choosingEmoji = true"
          >
            {{ emoji }}
          </button>
          <span
            v-else
            role="img"
            class="emoji-pebble flex h-[52px] w-[52px] shrink-0 items-center justify-center bg-surface-muted text-[28px]"
            :aria-label="`${t.settings.emoji}: ${emoji}`"
          >{{ emoji }}</span>
          <AppField
            class="flex-1"
            :label="t.settings.name"
            control-id="settings-name"
          >
            <input
              id="settings-name"
              v-model="name"
              type="text"
              required
              maxlength="60"
              autocomplete="off"
              :readonly="!mayEditBoard"
              class="font-display text-title-s"
              @change="saveName"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            >
          </AppField>
        </div>
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="settings-columns"
      >
        <h2
          id="settings-columns"
          class="section-heading px-1"
        >
          {{ t.settings.columns }}
        </h2>
        <ColumnSettingsList
          v-model="columns"
          :readonly="!mayEditColumns"
          @rename="renameColumn"
          @subtitle="setColumnSubtitle"
          @reordered="saveOrder"
          @delete="askDelete"
        />
        <!-- The label is in the field's border, so the button centres on the
             field (handoff Input "withButton"): both sit on the bottom, the
             44px button 4px up in the 52px field. -->
        <form
          v-if="mayEditColumns"
          class="mt-2 flex items-end gap-2.5"
          @submit.prevent="addColumn"
        >
          <AppField
            class="flex-1"
            :label="t.settings.newColumn"
            control-id="settings-new-column"
          >
            <input
              id="settings-new-column"
              v-model="newColumn"
              type="text"
              maxlength="40"
              autocomplete="off"
              :placeholder="newColumnExample.prompt.value"
            >
          </AppField>
          <button
            type="submit"
            class="mb-1 h-11 shrink-0 rounded-pill bg-inverse px-5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            :disabled="!canAddColumn"
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
          class="section-heading px-1"
        >
          {{ t.settings.members }}
        </h2>
        <MemberSettingsList
          :members="members"
          :is-owner="board.isOwner"
          @manage="manage"
        />
        <PermissionSwitches
          v-if="!board.isOwner"
          :title="t.settings.yourPermissions"
          :permissions="board.permissions"
          :busy="null"
          readonly
          :hint="t.settings.yourPermissionsHint"
        />
      </section>

      <section
        v-if="board.defaultPermissions"
        class="flex flex-col gap-3"
        aria-labelledby="settings-for-new-members"
      >
        <h2
          id="settings-for-new-members"
          class="section-heading px-1"
        >
          {{ t.settings.forNewMembers }}
        </h2>
        <p class="px-1 text-small text-text-muted">
          {{ t.settings.forNewMembersHint }}
        </p>
        <PermissionSwitches
          :title="t.settings.permissions"
          :permissions="board.defaultPermissions"
          :busy="switchingDefault"
          @switched="switchDefaults"
        />
      </section>

      <section
        v-if="board.inviteToken"
        class="flex flex-col gap-3"
        aria-labelledby="settings-invite"
      >
        <h2
          id="settings-invite"
          class="section-heading px-1"
        >
          {{ t.settings.invite }}
        </h2>
        <div class="flex flex-col">
          <AppField
            :label="t.settings.inviteLink"
            control-id="settings-invite-link"
          >
            <input
              id="settings-invite-link"
              :value="inviteLink"
              type="text"
              readonly
              aria-describedby="settings-invite-hint"
              class="truncate"
              @focus="($event.target as HTMLInputElement).select()"
            >
          </AppField>
          <p
            id="settings-invite-hint"
            class="field-helper"
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
            class="relative rounded-pill px-5 py-3.5 text-button transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            :class="canShare ? 'bg-surface-muted text-text' : 'bg-inverse text-on-inverse'"
            :aria-label="t.settings.copyLink"
            @click="copyLink"
          >
            <span class="relative inline-grid overflow-hidden">
              <Transition name="flip">
                <span
                  :key="copied ? 'copied' : 'copy'"
                  class="[grid-area:1/1]"
                >{{ copied ? t.settings.copiedShort : t.settings.copyLink }}</span>
              </Transition>
            </span>
            <PebbleBurst
              v-if="copied"
              :key="copied.key"
              color="var(--color-sage)"
            />
          </button>
          <DangerButton
            v-if="board.isOwner"
            @click="confirmingReset = true"
          >
            {{ t.settings.resetLink }}
          </DangerButton>
        </div>
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="settings-archive"
      >
        <h2
          id="settings-archive"
          class="section-heading px-1"
        >
          {{ t.settings.archive }}
        </h2>
        <p class="px-1 text-small text-text-muted">
          {{ t.settings.archiveHint }}
        </p>
        <ArchivedDishList
          v-if="archive"
          :dishes="archive.dishes"
          :is-owner="board.isOwner"
          :may-restore="mayRestore"
          @restore="restoreArchived"
          @purge="dish => purging = dish"
        />
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
      v-model:open="memberSheetOpen"
      variant="dialog"
      :title="memberSheetTitle"
      :close-label="t.settings.close"
    >
      <template v-if="selectedMember">
        <p
          v-if="memberAction"
          class="mt-3 text-body text-text-muted"
        >
          {{ memberAction === 'hand-over' ? t.settings.handOverBody(selectedMember.name) : t.settings.removeBody(selectedMember.name) }}
        </p>
        <PermissionSwitches
          v-else-if="selectedMember.permissions"
          class="mt-5"
          :title="t.settings.permissions"
          :permissions="selectedMember.permissions"
          :busy="switchingPermission"
          @switched="(changes, what) => selectedMember && switchPermissions(selectedMember, changes, what)"
        />
        <div class="mt-5 flex flex-col gap-2">
          <template v-if="!memberAction">
            <button
              type="button"
              class="rounded-pill bg-surface-muted px-5 py-3.5 text-button text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
              @click="memberAction = 'hand-over'"
            >
              {{ t.settings.handOver }}
            </button>
            <DangerButton @click="memberAction = 'remove'">
              {{ t.settings.removeMember }}
            </DangerButton>
          </template>
          <button
            v-else-if="memberAction === 'hand-over'"
            type="button"
            class="rounded-pill bg-inverse px-5 py-3.5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            @click="handOver(selectedMember)"
          >
            {{ t.settings.handOver }}
          </button>
          <DangerButton
            v-else
            @click="removeMember(selectedMember)"
          >
            {{ t.settings.removeMember }}
          </DangerButton>
          <button
            type="button"
            class="rounded-pill px-5 py-3 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
            @click="selectedMember = null"
          >
            {{ t.settings.cancel }}
          </button>
        </div>
      </template>
    </AppSheet>

    <AppSheet
      v-model:open="confirmingLeave"
      variant="dialog"
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
      variant="dialog"
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
        <AppField
          class="mt-3"
          :label="t.settings.deleteTypeName(saved.name)"
          control-id="settings-delete-name"
        >
          <input
            id="settings-delete-name"
            v-model="typedName"
            type="text"
            autocomplete="off"
            @keydown.enter="nameTyped || shake($event.target as Element)"
          >
        </AppField>
        <DangerButton
          type="submit"
          class="mt-3 disabled:opacity-50"
          :disabled="!nameTyped"
        >
          {{ t.settings.deleteBoard }}
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
      variant="dialog"
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
      v-model:open="purgingOpen"
      variant="dialog"
      :title="purging ? t.settings.purgeConfirm(purging.title) : ''"
      :close-label="t.settings.close"
    >
      <p class="mt-3 text-body text-text-muted">
        {{ t.settings.purgeBody }}
      </p>
      <div class="mt-5 flex flex-col gap-2">
        <DangerButton @click="purgeArchived">
          {{ t.settings.deleteForGood }}
        </DangerButton>
        <button
          type="button"
          class="rounded-pill px-5 py-3 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          @click="purging = null"
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
      variant="dialog"
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
          class="flex cursor-pointer items-center gap-3 rounded-field bg-surface-muted px-5 py-3.5 text-button transition-colors duration-fade ease-fade hover:bg-line-strong has-[:checked]:ring-2 has-[:checked]:ring-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus"
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
/* A label flipping to another: the old one rolls up and out, the new one
   pops up from below. Reduced motion: it just swaps. */
.flip-enter-active {
  transition: translate var(--dur-pop) var(--ease-pop), opacity var(--dur-pop) var(--ease-fade);
}
.flip-leave-active {
  transition: translate 200ms var(--ease-swoosh), opacity 200ms var(--ease-fade);
}
.flip-enter-from {
  translate: 0 100%;
  opacity: 0;
}
.flip-leave-to {
  translate: 0 -100%;
  opacity: 0;
}
</style>
