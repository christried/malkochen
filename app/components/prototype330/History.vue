<script setup lang="ts">
import type { CookingView } from '~~/server/utils/cookings'
import type { DishView } from '~~/server/utils/dishes'
import { neverCookedScene } from '~/utils/never-cooked'

// PROTOTYPE #330: throwaway, never merge. The Dish History ("Verlauf") at
// the bottom of the Dish detail (#318 stories 1 to 18), in place of the
// Cooking History: when the Dish was added, its Cookings, Votes and
// Comments, oldest first like a chat, and the comment field under it.
// Votes and Comments are made up (fakeHistory); the Cookings are the Dish's
// own, and deleting one works as today. Comments written here stay until
// the page reloads.
//   A, chat: Comments as speech bubbles (yours on the right), everything
//      else as small lines in the middle; a "Neu" line where what's new
//      since you last opened it starts. 👍 👎 beside the comment field.
//   B, timeline: a line down the left with a dot per entry (the person's
//      picture for a Comment), Comments in the detail's serif. 👍 👎 under
//      the heading, with "Wie war's?".
//   C, cards: each entry a row like today's Cooking History entries, with
//      its date pebble; Votes in a row of their own, everyone's together.
//      👍 👎 as chips with their counts under the heading.
const props = defineProps<{ dish: DishView, variant: string }>()
const emit = defineEmits<{ cook: [origin: Point], delete: [cooking: CookingView] }>()
const t = useStrings()
const route = useRoute()
const headingId = useId()
const { data: me } = useMe()
const mePerson = computed<Person | null>(() => me.value ? { name: me.value.name, image: me.value.image } : null)

const neverCooked = computed(() => `/clips/${neverCookedScene(props.dish.id)}`)
const cooked = computed(() => props.dish.cookings.length > 0)
const summary = computed(() => {
  const [last] = props.dish.cookings
  return last ? t.cooking.summary(props.dish.cookings.length, new Date(last.cookedAt)) : t.detail.cookingHistoryEmpty
})

// What was made up, then what you wrote, changed or deleted here.
type Comment = Extract<HistoryEntry, { kind: 'comment' }>
const written = ref<Comment[]>([])
const changed = ref(new Map<Comment, string>())
const gone = ref(new Set<Comment>())
const made = computed(() => fakeHistory(props.dish, mePerson.value))

// Your own Vote: the made-up one until you change it.
const stored = useP330MyVote(() => props.dish.id)
const touched = useState<Record<string, boolean>>('prototype-330-voted', () => ({}))
const madeMine = computed(() => made.value.find((e): e is Extract<HistoryEntry, { kind: 'vote' }> => e.kind === 'vote' && e.mine))
const myVote = computed(() => touched.value[props.dish.id] ? stored.value : madeMine.value ? (madeMine.value.up ? 'up' : 'down') : null)
const votedAt = ref<Date | null>(null)
function pick(up: boolean) {
  const wanted = up ? 'up' : 'down'
  stored.value = myVote.value === wanted ? null : wanted
  touched.value = { ...touched.value, [props.dish.id]: true }
  votedAt.value = new Date()
}

const entries = computed<HistoryEntry[]>(() => {
  const list = made.value
    .filter(e => !(e.kind === 'comment' && gone.value.has(e)))
    .filter(e => !(e.kind === 'vote' && e.mine && touched.value[props.dish.id]))
    .map(e => e.kind === 'comment' && changed.value.has(e) ? { ...e, text: changed.value.get(e)!, edited: true } : e)
  const mine: HistoryEntry[] = []
  if (touched.value[props.dish.id] && myVote.value && mePerson.value) {
    mine.push({ kind: 'vote', at: votedAt.value ?? new Date(), by: mePerson.value, up: myVote.value === 'up', mine: true })
  }
  const own = written.value.filter(c => !gone.value.has(c)).map(c => changed.value.has(c) ? { ...c, text: changed.value.get(c)!, edited: true } : c)
  return [...list, ...mine, ...own].sort((a, b) => a.at.getTime() - b.at.getTime())
})
// The made-up originals, to edit and delete what's shown.
function original(entry: HistoryEntry): Comment | undefined {
  if (entry.kind !== 'comment') return
  return [...made.value, ...written.value].find((c): c is Comment => c.kind === 'comment' && c.at.getTime() === entry.at.getTime() && c.by === entry.by)
}

const tally = computed(() => {
  const votes = entries.value.filter((e): e is Extract<HistoryEntry, { kind: 'vote' }> => e.kind === 'vote')
  return { up: votes.filter(v => v.up), down: votes.filter(v => !v.up) }
})
const firstUnread = computed(() => entries.value.find(e => e.kind === 'comment' && e.unread))

// C: Votes next to each other become one row.
type Row = HistoryEntry | { kind: 'votes', at: Date, votes: Extract<HistoryEntry, { kind: 'vote' }>[] }
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  for (const e of entries.value) {
    const last = out.at(-1)
    if (e.kind === 'vote' && last?.kind === 'votes') last.votes.push(e)
    else if (e.kind === 'vote') out.push({ kind: 'votes', at: e.at, votes: [e] })
    else out.push(e)
  }
  return out
})

function cookingOf(entry: HistoryEntry): CookingView | undefined {
  return entry.kind === 'cooking' ? props.dish.cookings.find(c => c.id === entry.cookingId) : undefined
}

function when(at: Date): string {
  return p330IsToday(at) ? `heute, ${p330Time(at)}` : t.cooking.date(at)
}
const DAY_MS = 24 * 60 * 60 * 1000
const isFresh = (at: Date) => Date.now() - at.getTime() < DAY_MS

// The comment field.
const text = ref('')
const editing = ref<Comment | null>(null)
const menuOpen = ref<Comment | null>(null)
const field = useTemplateRef<HTMLTextAreaElement>('field')
const composer = useTemplateRef<HTMLElement>('composer')
function send() {
  const said = text.value.trim()
  if (!said || !mePerson.value) return
  if (editing.value) {
    changed.value = new Map(changed.value).set(editing.value, said)
    editing.value = null
  }
  else {
    written.value = [...written.value, { kind: 'comment', at: new Date(), by: mePerson.value, text: said, edited: false, mine: true, unread: false }]
  }
  text.value = ''
}
function edit(entry: HistoryEntry) {
  const c = original(entry)
  if (!c || entry.kind !== 'comment') return
  menuOpen.value = null
  editing.value = c
  text.value = entry.text
  field.value?.focus()
}
function remove(entry: HistoryEntry) {
  const c = original(entry)
  if (!c) return
  menuOpen.value = null
  gone.value = new Set(gone.value).add(c)
}
function toggleMenu(entry: HistoryEntry) {
  const c = original(entry)
  menuOpen.value = c && menuOpen.value !== c ? c : null
}
const isMenuOpen = (entry: HistoryEntry) => !!menuOpen.value && original(entry) === menuOpen.value

// The field grows with what's written, up to five lines.
watch(text, () => nextTick(() => {
  const el = field.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 5 * 22 + 26)}px`
}))

// "Kommentieren" in the Gekocht toast opens the Dish here.
onMounted(() => {
  if (route.query.p330comment !== '1') return
  setTimeout(() => {
    composer.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    field.value?.focus({ preventScroll: true })
  }, 500)
})

const sentence = (entry: HistoryEntry): string => {
  const name = entry.by?.name ?? 'Gelöschtes Konto'
  switch (entry.kind) {
    case 'added': return `${name} hat das Gericht hinzugefügt`
    case 'cooking': return `${name} hat es gekocht`
    case 'vote': return entry.up ? `${name} fand es gut` : `${name} fand es nicht so gut`
    default: return name
  }
}
const iconBtn = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-transform duration-tap ease-tap hover:bg-surface-muted active:scale-95 focus-visible:outline-2 focus-visible:outline-focus'
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="mt-2 flex flex-col gap-4 border-t border-line pt-5"
    :data-p330-verlauf="variant"
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
          Verlauf
        </h2>
        <p class="text-small text-text-muted">
          {{ summary }}
        </p>
      </div>
      <CookButton
        class="shrink-0 px-4 py-2.5"
        :cooked="cooked"
        @cook="origin => emit('cook', origin)"
      />
    </div>

    <!-- B: your Vote under the heading. -->
    <div
      v-if="variant === 'B' && cooked"
      class="flex items-center gap-3"
    >
      <span class="text-small text-text-muted">Wie war’s?</span>
      <Prototype330VoteButtons
        :vote="myVote"
        :size="40"
        light
        @pick="pick"
      />
    </div>
    <!-- C: everyone's Votes as two chips, yours filled. -->
    <div
      v-if="variant === 'C' && cooked"
      class="flex items-center gap-2"
    >
      <button
        v-for="up in [true, false]"
        :key="String(up)"
        type="button"
        class="p330-chip flex h-10 items-center gap-1.5 rounded-pill px-3.5 text-button tabular-nums transition duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        :class="myVote === (up ? 'up' : 'down') ? (up ? 'bg-sage text-sage-ink' : 'p330-down text-text') : 'bg-surface-muted'"
        :aria-pressed="myVote === (up ? 'up' : 'down')"
        @click="pick(up)"
      >
        <span class="text-[17px]">{{ up ? '👍' : '👎' }}</span>{{ up ? tally.up.length : tally.down.length }}
      </button>
    </div>

    <div
      v-if="!cooked"
      class="mx-auto aspect-[510/354] w-[min(50vw,180px)]"
    >
      <SvgLoop
        :src="neverCooked"
        play
        transparent
      />
    </div>

    <!-- A: chat. -->
    <ol
      v-if="variant === 'A'"
      class="flex flex-col gap-3"
    >
      <template
        v-for="(entry, i) in entries"
        :key="`${entry.kind}${entry.at.getTime()}${i}`"
      >
        <li
          v-if="entry === firstUnread"
          class="flex items-center gap-2 text-overline uppercase text-neu-accent"
          aria-label="Neu seit du zuletzt hier warst"
        >
          <span class="h-px flex-1 bg-neu-accent/50" />
          <span class="p330-neu px-2 py-0.5 text-neu-ink">Neu</span>
          <span class="h-px flex-1 bg-neu-accent/50" />
        </li>
        <li
          v-if="entry.kind === 'comment'"
          class="flex items-end gap-2"
          :class="entry.mine ? 'flex-row-reverse pl-10' : 'pr-10'"
        >
          <UserAvatar
            v-if="!entry.mine"
            :name="entry.by?.name ?? '?'"
            :image="entry.by?.image"
            :size="28"
            class="mb-0.5"
          />
          <div
            class="flex min-w-0 flex-col gap-1"
            :class="entry.mine ? 'items-end' : 'items-start'"
          >
            <span class="px-1 text-caption text-text-muted">
              <b
                v-if="!entry.mine"
                class="font-semibold text-text"
              >{{ entry.by?.name ?? 'Gelöschtes Konto' }}</b>
              {{ when(entry.at) }}<template v-if="entry.edited">, bearbeitet</template>
            </span>
            <div class="flex items-center gap-1">
              <button
                v-if="entry.mine"
                type="button"
                :class="iconBtn"
                aria-label="Kommentar bearbeiten oder löschen"
                @click="toggleMenu(entry)"
              >
                <Prototype330Icon name="more" />
              </button>
              <p
                class="whitespace-pre-line break-words px-3.5 py-2.5 text-body"
                :class="entry.mine ? 'p330-mine' : 'p330-theirs bg-surface-muted'"
              >
                {{ entry.text }}
              </p>
            </div>
            <Prototype330CommentMenu
              v-if="isMenuOpen(entry)"
              @edit="edit(entry)"
              @remove="remove(entry)"
            />
          </div>
        </li>
        <li
          v-else-if="entry.kind === 'cooking'"
          class="flex items-center justify-center gap-1"
        >
          <span class="flex items-center gap-1.5 rounded-pill bg-sage px-3 py-1.5 text-label text-sage-ink">
            <Prototype330Icon
              name="pot"
              :size="15"
            />
            {{ entry.by?.name ?? 'Gelöschtes Konto' }} hat es gekocht, {{ when(entry.at) }}
          </span>
          <button
            type="button"
            :class="iconBtn"
            :aria-label="t.cooking.deleteLabel(entry.at)"
            :data-tooltip="t.cooking.deleteTip"
            @click="cookingOf(entry) && emit('delete', cookingOf(entry)!)"
          >
            <Prototype330Icon
              name="trash"
              :size="15"
            />
          </button>
        </li>
        <li
          v-else
          class="flex items-center justify-center gap-1.5 text-caption text-text-muted"
        >
          <UserAvatar
            v-if="entry.by"
            :name="entry.by.name"
            :image="entry.by.image"
            :size="18"
          />
          <span v-if="entry.kind === 'vote'">{{ entry.by.name }} <span class="text-[14px]">{{ entry.up ? '👍' : '👎' }}</span></span>
          <span v-else>{{ sentence(entry) }}, {{ when(entry.at) }}</span>
        </li>
      </template>
    </ol>

    <!-- B: timeline. -->
    <ol
      v-else-if="variant === 'B'"
      class="p330-line relative flex flex-col gap-4 pl-1"
    >
      <li
        v-for="(entry, i) in entries"
        :key="`${entry.kind}${entry.at.getTime()}${i}`"
        class="relative flex gap-3"
      >
        <span class="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface">
          <UserAvatar
            v-if="entry.kind === 'comment'"
            :name="entry.by?.name ?? '?'"
            :image="entry.by?.image"
            :size="32"
          />
          <span
            v-else-if="entry.kind === 'cooking'"
            class="flex h-8 w-8 items-center justify-center rounded-full bg-sage text-sage-ink"
          ><Prototype330Icon
            name="pot"
            :size="16"
          /></span>
          <span
            v-else-if="entry.kind === 'vote'"
            class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-[15px]"
          >{{ entry.up ? '👍' : '👎' }}</span>
          <span
            v-else
            class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-text-muted"
          ><Prototype330Icon
            name="plus"
            :size="16"
          /></span>
          <span
            v-if="entry.kind === 'comment' && entry.unread"
            class="p330-dot absolute -right-0.5 -top-0.5"
          />
        </span>
        <div class="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">
          <div class="flex items-baseline gap-2 text-small">
            <span class="min-w-0 flex-1">
              <template v-if="entry.kind === 'comment'"><b class="font-semibold">{{ entry.by?.name ?? 'Gelöschtes Konto' }}</b></template>
              <template v-else>{{ sentence(entry) }}</template>
            </span>
            <span class="shrink-0 text-caption text-text-muted">{{ when(entry.at) }}<template v-if="entry.kind === 'comment' && entry.edited">, bearbeitet</template></span>
            <button
              v-if="entry.kind === 'cooking'"
              type="button"
              :class="iconBtn"
              class="-my-1.5"
              :aria-label="t.cooking.deleteLabel(entry.at)"
              :data-tooltip="t.cooking.deleteTip"
              @click="cookingOf(entry) && emit('delete', cookingOf(entry)!)"
            >
              <Prototype330Icon
                name="trash"
                :size="15"
              />
            </button>
            <button
              v-if="entry.kind === 'comment' && entry.mine"
              type="button"
              :class="iconBtn"
              class="-my-1.5"
              aria-label="Kommentar bearbeiten oder löschen"
              @click="toggleMenu(entry)"
            >
              <Prototype330Icon name="more" />
            </button>
          </div>
          <p
            v-if="entry.kind === 'comment'"
            class="whitespace-pre-line break-words font-display text-body-serif"
          >
            {{ entry.text }}
          </p>
          <Prototype330CommentMenu
            v-if="isMenuOpen(entry)"
            @edit="edit(entry)"
            @remove="remove(entry)"
          />
        </div>
      </li>
    </ol>

    <!-- C: cards like today's Cooking History entries. -->
    <ol
      v-else
      class="flex flex-col gap-2"
    >
      <li
        v-for="(row, i) in rows"
        :key="`${row.kind}${row.at.getTime()}${i}`"
        class="relative flex items-start gap-3 rounded-[16px] p-3"
        :class="row.kind === 'comment' && row.unread ? 'p330-unread' : 'bg-surface-muted'"
      >
        <span
          class="shrink-0 rounded-pill px-2.5 py-1 text-label"
          :class="isFresh(row.at) ? 'bg-sage text-sage-ink' : 'bg-surface text-text'"
        >{{ t.cooking.date(row.at) }}</span>
        <div class="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
          <template v-if="row.kind === 'comment'">
            <p class="whitespace-pre-line break-words font-display text-body-serif">
              {{ row.text }}
            </p>
            <span class="flex items-center gap-1.5 text-caption text-text-muted">
              <UserAvatar
                :name="row.by?.name ?? '?'"
                :image="row.by?.image"
                :size="18"
              />
              {{ row.by?.name ?? 'Gelöschtes Konto' }}<template v-if="row.edited">, bearbeitet</template>
            </span>
            <Prototype330CommentMenu
              v-if="isMenuOpen(row)"
              @edit="edit(row)"
              @remove="remove(row)"
            />
          </template>
          <template v-else-if="row.kind === 'votes'">
            <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-small">
              <span
                v-for="(v, j) in row.votes"
                :key="j"
                class="inline-flex items-center gap-1"
              >
                <UserAvatar
                  :name="v.by.name"
                  :image="v.by.image"
                  :size="18"
                />{{ v.by.name }} <span class="text-[14px]">{{ v.up ? '👍' : '👎' }}</span>
              </span>
            </p>
          </template>
          <template v-else>
            <p class="text-small">
              {{ row.kind === 'cooking' ? 'Gekocht' : 'Hinzugefügt' }}
            </p>
            <span
              v-if="row.by"
              class="flex items-center gap-1.5 text-caption text-text-muted"
            >
              <UserAvatar
                :name="row.by.name"
                :image="row.by.image"
                :size="18"
              />
              {{ row.kind === 'cooking' ? t.cooking.by(row.by.name) : `von ${row.by.name}` }}
            </span>
          </template>
        </div>
        <span
          v-if="row.kind === 'comment' && row.unread"
          class="p330-neu absolute -right-1.5 -top-2 px-2 py-0.5 text-overline uppercase text-neu-ink"
        >Neu</span>
        <button
          v-if="row.kind === 'cooking'"
          type="button"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-transform duration-tap ease-tap hover:bg-surface active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          :aria-label="t.cooking.deleteLabel(row.at)"
          :data-tooltip="t.cooking.deleteTip"
          @click="cookingOf(row) && emit('delete', cookingOf(row)!)"
        >
          <Prototype330Icon
            name="trash"
            :size="18"
          />
        </button>
        <button
          v-if="row.kind === 'comment' && row.mine"
          type="button"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-transform duration-tap ease-tap hover:bg-surface active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          aria-label="Kommentar bearbeiten oder löschen"
          @click="toggleMenu(row)"
        >
          <Prototype330Icon
            name="more"
            :size="18"
          />
        </button>
      </li>
    </ol>

    <!-- The comment field, under the Verlauf. A: with your Vote beside it. -->
    <form
      ref="composer"
      class="flex items-end gap-2"
      data-p330-composer
      @submit.prevent="send"
    >
      <Prototype330VoteButtons
        v-if="variant === 'A' && cooked"
        class="mb-1"
        :vote="myVote"
        :size="44"
        light
        @pick="pick"
      />
      <div class="relative flex min-w-0 flex-1 items-end rounded-[24px] bg-surface-muted focus-within:outline-2 focus-within:outline-focus">
        <textarea
          ref="field"
          v-model="text"
          rows="1"
          maxlength="1000"
          class="block max-h-[136px] min-h-[52px] w-full resize-none bg-transparent py-[15px] pl-4 pr-1 text-body outline-none placeholder:text-text-muted"
          :placeholder="editing ? 'Kommentar bearbeiten' : 'Kommentieren'"
          aria-label="Kommentar"
          @keydown.enter.exact.prevent="send"
        />
        <button
          type="submit"
          class="m-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-inverse text-on-inverse transition duration-tap ease-tap enabled:active:scale-90 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-focus"
          :disabled="!text.trim()"
          :aria-label="editing ? 'Sichern' : 'Senden'"
          :data-tooltip="editing ? 'Sichern' : 'Senden'"
        >
          <Prototype330Icon
            name="send"
            :size="18"
          />
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.p330-theirs {
  border-radius: 6px 20px 20px 20px;
}
.p330-mine {
  border-radius: 20px 6px 20px 20px;
  background: var(--color-name-mark);
  color: var(--color-text);
}
.p330-neu {
  border-radius: var(--radius-blob);
  background: var(--gradient-neu);
  box-shadow: var(--shadow-neu);
  rotate: -4deg;
}
.p330-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--color-neu-accent);
  box-shadow: 0 0 0 2px var(--color-surface);
}
.p330-unread {
  background: color-mix(in oklab, var(--color-butter) 18%, var(--color-surface-muted));
  box-shadow: inset 0 0 0 2px color-mix(in oklab, var(--color-neu-accent) 55%, transparent);
}
.p330-down {
  background: color-mix(in oklab, var(--color-carrot) 70%, var(--color-surface));
}
/* B: the line through the dots' middles. */
.p330-line::before {
  content: '';
  position: absolute;
  left: calc(0.25rem + 15px);
  top: 16px;
  bottom: 16px;
  width: 2px;
  border-radius: 2px;
  background: var(--color-line-strong);
}
</style>
