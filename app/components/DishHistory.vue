<script setup lang="ts">
import type { CommentView } from '~~/server/utils/comments'
import type { CookingView } from '~~/server/utils/cookings'
import type { DishHistoryEntry } from '~~/server/utils/dish-history'
import type { DishView } from '~~/server/utils/dishes'
import type { CommentResult } from '~/board/dish-histories'
import type { VoteResult } from '~/board/dish-votes'
import { neverCookedScene } from '~/utils/never-cooked'

// A Dish's Dish History at the bottom of its detail ("Verlauf", #332; the
// look #330 picked, its variant B): "3× gekocht · zuletzt 12. Sept." under its
// achievement badge, "Gekocht ✓", once Cooked "Wie war's?" with 👍 👎 for
// the Member's Vote (#334), and a line down the left with a dot per entry,
// oldest first like a chat: a plus for who added the Dish, a pot for each
// Cooking (with its bin), the thumb for each Member's Vote, on a backdrop
// of its own for up and for down, the author's Profile Picture for each
// Comment, set in the detail's serif on a backdrop of its own. Under it the
// comment field. A Comment's "…" offers its author "Bearbeiten" and
// "Löschen", and the Owner "Löschen" on anyone's. Never cooked, it loops one
// of the handoff's three "never cooked" scenes above the line.
//
// The history comes from the Board module, which loads it from the server
// as the detail opens (its Comments; its Cookings are the Board's) and
// writes Comments and Votes. Each write's result goes up as `comment` or
// `vote`, for the detail to show its notice. A Cooking still being recorded, or a Comment still
// being written, shows but can't be changed yet. "Kommentieren" in the
// Gekocht toast opens the detail with focus in the comment field
// (useCommentRequest).
const props = defineProps<{ dish: DishView, boardId: string, isOwner: boolean }>()
const emit = defineEmits<{
  cook: [origin: Point]
  deleteCooking: [cooking: CookingView]
  comment: [result: CommentResult]
  vote: [result: VoteResult]
}>()
const t = useStrings()
const boardModule = useBoardModule()
const { data: me } = useMe()
const headingId = useId()
const neverCooked = computed(() => `/clips/${neverCookedScene(props.dish.id)}`)

const summary = computed(() => {
  const [last] = props.dish.cookings
  return last ? t.cooking.summary(props.dish.cookings.length, new Date(last.cookedAt)) : t.detail.cookingHistoryEmpty
})

// Loaded as the detail opens, and again for another Dish.
const loadFailed = ref(false)
async function load() {
  loadFailed.value = !await boardModule.openDish(props.dish.id)
}
onMounted(load)
watch(() => props.dish.id, load)

const entries = computed(() => boardModule.historyOf(props.dish.id))

// An entry keeps its key when the server fills in its id.
const keys = new WeakMap<object, number>()
let lastKey = 0
function keyOf(entry: DishHistoryEntry): string {
  if (entry.kind === 'added') return 'added'
  const of = entry.kind === 'cooking' ? entry.cooking : entry.kind === 'vote' ? entry.vote : entry.comment
  let key = keys.get(of)
  if (key === undefined) keys.set(of, key = ++lastKey)
  return `${entry.kind}-${key}`
}

const when = (at: string) => t.history.when(new Date(at))
const nameOf = (person: { name: string } | null) => person?.name ?? t.history.deletedAccount
// One still being recorded was recorded by whoever is looking.
const recorderOf = (cooking: CookingView) => cooking.id ? nameOf(cooking.recordedBy) : me.value?.name ?? ''

// The Member's own Vote: thumbs up (true), down (false), or none.
const myVote = computed(() => voteOf(props.dish, me.value?.id))
function vote(up: boolean | null) {
  const result = me.value && boardModule.vote(props.dish.id, up, { id: me.value.id, name: me.value.name, image: me.value.image })
  if (result) emit('vote', result)
}

const isOwn = (comment: CommentView) => !!me.value && comment.author?.id === me.value.id
// Without "comment and vote" the Verlauf is only to read: no comment field,
// no editing, no 👍/👎. Deleting one's own Comment stays.
const mayTalk = computed(() => boardModule.may('commentAndVote'))
const canDelete = (comment: CommentView) => isOwn(comment) || props.isOwner

// The "…" of one Comment at a time.
const menuFor = ref<string | null>(null)
function toggleMenu(comment: CommentView) {
  menuFor.value = menuFor.value === comment.id ? null : comment.id
}

// The comment field: a new Comment, or one of the Member's own being edited.
const text = ref('')
const editing = ref<CommentView | null>(null)
const field = useTemplateRef<HTMLTextAreaElement>('field')
const sendable = computed(() => !!commentText(text.value))

function submit() {
  if (!sendable.value) return
  const result = editing.value
    ? boardModule.editComment(props.dish.id, editing.value.id, text.value)
    : me.value && boardModule.writeComment(props.dish.id, text.value, { id: me.value.id, name: me.value.name, image: me.value.image })
  if (!result) {
    // The Comment being edited is gone (deleted meanwhile): what was
    // written stays in the field, to send as a new one.
    editing.value = null
    return
  }
  editing.value = null
  text.value = ''
  showResult(result)
}

// Enter sends where there is a keyboard to type on (Shift+Enter for a new
// line). On a phone's keyboard, which has no Shift+Enter, Enter is a new
// line, and the arrow sends.
const enterSends = useMediaQuery(FINE_POINTER)
function onEnter(event: KeyboardEvent) {
  if (!enterSends.value || event.isComposing) return
  event.preventDefault()
  submit()
}

// A Comment that couldn't be written comes back to the field, unless
// something else was started there meanwhile.
function showResult(result: CommentResult) {
  emit('comment', result)
  void result.settled?.then((ended) => {
    if (ended.notice === 'commentFailed' && !text.value && !editing.value) text.value = ended.comment.text
  })
}

function edit(comment: CommentView) {
  menuFor.value = null
  editing.value = comment
  text.value = comment.text
  field.value?.focus()
}

function cancelEdit() {
  editing.value = null
  text.value = ''
}

// Escape in the field while editing leaves the edit, not the detail.
function onFieldEscape(event: KeyboardEvent) {
  if (!editing.value) return
  event.preventDefault()
  event.stopPropagation()
  cancelEdit()
}

// "Kommentieren" in the Gekocht toast, for this Dish: focus goes to the
// field, which scrolls it into view, once the detail around it has opened
// (the page shows its dialog after this has mounted).
const commentRequest = useCommentRequest()
onMounted(() => watch([commentRequest, () => props.dish.id], async ([requested, dishId]) => {
  if (requested !== dishId) return
  commentRequest.value = null
  await nextTick()
  field.value?.focus()
}, { immediate: true }))

function remove(comment: CommentView) {
  menuFor.value = null
  if (editing.value === comment) cancelEdit()
  const result = boardModule.deleteComment(props.dish.id, comment.id)
  if (result) emit('comment', result)
}

const iconButton = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-transform duration-tap ease-tap enabled:hover:bg-surface-muted active:scale-95 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-focus'
const menuButton = 'rounded-pill bg-surface-muted px-3 py-1.5 text-label transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus'
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="mt-2 flex flex-col gap-4 border-t border-line pt-5"
    data-dish-history
  >
    <AchievementBadge
      v-if="dish.cookings.length"
      :count="dish.cookings.length"
    />
    <div class="flex items-center justify-between gap-3">
      <div class="flex flex-col gap-1">
        <h2
          :id="headingId"
          class="font-display text-title-s"
        >
          {{ t.history.heading }}
        </h2>
        <p
          class="text-small text-text-muted"
          data-cooking-summary
        >
          {{ summary }}
        </p>
      </div>
      <CookButton
        v-if="boardModule.may('moveDishes')"
        class="shrink-0 px-4 py-2.5"
        :cooked="dish.cookings.length > 0"
        @cook="origin => emit('cook', origin)"
      />
    </div>

    <div
      v-if="dish.cookings.length && mayTalk"
      class="flex items-center gap-3"
      data-how-was-it
    >
      <span class="text-small text-text-muted">{{ t.history.howWasIt }}</span>
      <VoteButtons
        :mine="myVote"
        @vote="vote"
      />
    </div>
    <div
      v-else-if="!dish.cookings.length"
      class="mx-auto aspect-[510/354] w-[min(50vw,180px)]"
    >
      <SvgLoop
        :src="neverCooked"
        play
        transparent
      />
    </div>

    <TransitionGroup
      tag="ol"
      name="entry"
      class="history-line relative flex flex-col gap-4"
    >
      <li
        v-for="entry in entries"
        :key="keyOf(entry)"
        class="relative flex gap-3"
        :data-cooking="entry.kind === 'cooking' || undefined"
        :data-comment="entry.kind === 'comment' || undefined"
        :data-vote-entry="entry.kind === 'vote' ? (entry.vote.up ? 'up' : 'down') : undefined"
        :data-history-added="entry.kind === 'added' || undefined"
      >
        <!-- The entry's dot on the line. -->
        <span class="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-bg">
          <UserAvatar
            v-if="entry.kind === 'comment'"
            :name="nameOf(entry.comment.author)"
            :image="entry.comment.author?.image"
            :size="32"
          />
          <span
            v-else-if="entry.kind === 'vote'"
            class="flex h-8 w-8 items-center justify-center rounded-full text-[15px]"
            :class="entry.vote.up ? 'vote-up' : 'vote-down'"
            aria-hidden="true"
          >{{ entry.vote.up ? '👍' : '👎' }}</span>
          <span
            v-else
            class="flex h-8 w-8 items-center justify-center rounded-full"
            :class="entry.kind === 'cooking' ? 'bg-sage text-sage-ink' : 'bg-surface-muted text-text-muted'"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <template v-if="entry.kind === 'cooking'">
                <path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
                <path d="M2 10h20M9 6c0-1 1-1.5 1-2.5M14 6c0-1 1-1.5 1-2.5" />
              </template>
              <path
                v-else
                d="M12 5v14M5 12h14"
              />
            </svg>
          </span>
        </span>

        <div class="flex min-w-0 flex-1 flex-col gap-1.5 pt-1.5">
          <div class="flex items-baseline gap-2 text-small">
            <span class="min-w-0 flex-1 break-words">
              <b
                v-if="entry.kind === 'comment'"
                class="font-semibold"
              >{{ nameOf(entry.comment.author) }}</b>
              <template v-else-if="entry.kind === 'cooking'">{{ t.history.cooked(recorderOf(entry.cooking)) }}</template>
              <template v-else-if="entry.kind === 'vote'">{{ t.history.voted(entry.vote.voter.name, entry.vote.up) }}</template>
              <PersonPopover
                v-else-if="entry.by"
                :person="entry.by"
                :board-id="boardId"
                class="-mx-1.5 -my-0.5 rounded-pill px-1.5 py-0.5 text-left transition-colors duration-tap ease-tap hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus"
              >{{ t.history.added(entry.by.name) }}</PersonPopover>
              <template v-else>{{ t.history.added(t.history.deletedAccount) }}</template>
            </span>
            <span class="shrink-0 text-caption text-text-muted">
              {{ when(entry.at) }}<template v-if="entry.kind === 'comment' && entry.comment.editedAt">, {{ t.history.edited }}</template>
            </span>
            <button
              v-if="entry.kind === 'cooking' && boardModule.may('moveDishes')"
              type="button"
              class="-my-1.5"
              :class="iconButton"
              :aria-label="t.cooking.deleteLabel(new Date(entry.cooking.cookedAt))"
              :data-tooltip="t.cooking.deleteTip"
              :disabled="!entry.cooking.id"
              @click="emit('deleteCooking', entry.cooking)"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              ><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
            </button>
            <button
              v-else-if="entry.kind === 'comment' && entry.comment.id && canDelete(entry.comment)"
              type="button"
              class="-my-1.5"
              :class="iconButton"
              :aria-label="t.history.commentMenu(isOwn(entry.comment))"
              :aria-expanded="menuFor === entry.comment.id"
              :data-tooltip="t.history.commentMenu(isOwn(entry.comment))"
              @click="toggleMenu(entry.comment)"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="currentColor"
                aria-hidden="true"
              ><circle
                cx="5"
                cy="12"
                r="1.6"
              /><circle
                cx="12"
                cy="12"
                r="1.6"
              /><circle
                cx="19"
                cy="12"
                r="1.6"
              /></svg>
            </button>
          </div>
          <p
            v-if="entry.kind === 'comment'"
            class="comment self-start whitespace-pre-line break-words px-3.5 py-2.5 font-display text-body-serif"
          >
            {{ entry.comment.text }}
          </p>
          <span
            v-if="entry.kind === 'comment' && menuFor === entry.comment.id"
            class="flex gap-1.5"
          >
            <button
              v-if="isOwn(entry.comment) && mayTalk"
              type="button"
              :class="menuButton"
              @click="edit(entry.comment)"
            >
              {{ t.history.editComment }}
            </button>
            <button
              type="button"
              :class="menuButton"
              class="text-danger"
              @click="remove(entry.comment)"
            >
              {{ t.history.deleteComment }}
            </button>
          </span>
        </div>
      </li>
    </TransitionGroup>

    <p
      v-if="loadFailed"
      class="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-text-muted"
    >
      {{ t.history.loadFailed }}
      <button
        type="button"
        class="rounded-pill bg-surface-muted px-3 py-1.5 text-label text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        @click="load"
      >
        {{ t.history.retry }}
      </button>
    </p>

    <!-- The comment field, under the Verlauf like a chat's. -->
    <form
      v-if="mayTalk"
      class="flex flex-col gap-1.5"
      data-comment-form
      @submit.prevent="submit"
    >
      <p
        v-if="editing"
        class="flex items-center justify-between gap-3 px-1 text-caption text-text-muted"
      >
        {{ t.history.editPrompt }}
        <button
          type="button"
          class="rounded-pill px-2.5 py-1 text-label text-text transition-transform duration-tap ease-tap hover:bg-surface-muted active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          @click="cancelEdit"
        >
          {{ t.history.cancelEdit }}
        </button>
      </p>
      <div class="flex min-w-0 items-end rounded-[24px] bg-surface-muted focus-within:outline-2 focus-within:outline-focus">
        <textarea
          ref="field"
          v-model="text"
          rows="1"
          :maxlength="COMMENT_MAX"
          class="field block max-h-[136px] min-h-[52px] w-full resize-none bg-transparent py-[15px] pl-4 pr-1 text-body outline-none placeholder:text-text-muted"
          :placeholder="editing ? t.history.editPrompt : t.history.fieldPrompt"
          :aria-label="t.history.field"
          @keydown.enter.exact="onEnter"
          @keydown.esc="onFieldEscape"
        />
        <button
          type="submit"
          class="m-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-inverse text-on-inverse transition duration-tap ease-tap enabled:active:scale-90 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-focus"
          :disabled="!sendable"
          :aria-label="editing ? t.history.saveEdit : t.history.send"
          :data-tooltip="editing ? t.history.saveEdit : t.history.send"
        >
          <AppIcon
            v-if="editing"
            name="check"
          />
          <svg
            v-else
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></svg>
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
/* The line through the dots' middles, from the first to the last. */
.history-line::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 16px;
  bottom: 16px;
  width: 2px;
  border-radius: 2px;
  background: var(--color-line-strong);
}
/* A Vote's dot: thumbs up on sage, down on carrot, each apart from the
   other entries' (#330). */
.vote-up {
  background: color-mix(in oklab, var(--color-sage) 45%, var(--color-surface-muted));
}
.vote-down {
  background: color-mix(in oklab, var(--color-carrot) 35%, var(--color-surface-muted));
}
/* A Comment's backdrop, apart from the other entries' (#330). */
.comment {
  border-radius: 4px 18px 18px 18px;
  background: var(--color-surface-muted);
}
/* The field grows with what's written, up to five lines. */
.field {
  field-sizing: content;
}

/* An entry added opens (max-height 0 → 160px) and fades in. Deleted, it
   slides 40px aside and the list closes up; restored, it comes back.
   Reduced motion: it only fades. */
.entry-enter-active {
  overflow: hidden;
  transition: max-height var(--dur-settle) var(--ease-settle), opacity var(--dur-fade) var(--ease-fade);
}
.entry-enter-from {
  max-height: 0;
  opacity: 0;
}
.entry-enter-to {
  max-height: 160px;
}
.entry-leave-active {
  position: absolute;
  inset-inline: 0;
  transition: translate var(--dur-cooking-collapse) var(--ease-swoosh), opacity var(--dur-cooking-collapse) var(--ease-fade);
}
.entry-leave-to {
  translate: 40px 0;
  opacity: 0;
}
.entry-move {
  transition: transform var(--dur-settle) var(--ease-settle);
}
@media (prefers-reduced-motion: reduce) {
  .entry-enter-active {
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
  .entry-enter-from,
  .entry-enter-to {
    max-height: none;
  }
  .entry-leave-active {
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
  .entry-leave-to {
    translate: none;
  }
}
</style>
