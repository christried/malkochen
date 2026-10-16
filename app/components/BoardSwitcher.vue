<script setup lang="ts">
import type { BoardListing, BoardNameAndEmoji } from '~~/server/utils/boards'
import { boardPath } from '~~/shared/address'

// The handoff's BoardSwitcher (PRD story 39): the Board's emoji and name at
// the top of the Board, as a pill that opens a dropdown of the user's Boards
// (emoji pebble, name, Dish count, Members, a check on this one) and
// "Neues Board". Picking a Board opens it; the Board page remembers it as the
// one to reopen next time. The list is fetched each time it opens, so a
// Board renamed or created meanwhile shows; the Board picked shows its name
// and Columns from it while it opens (useBoardListings). On phones its last
// rows open your settings (a sheet over the Board) and the legal pages
// (LegalLinks), which the header has no room for there: they stand in for
// the user menu.
// `dishCount`: how many Dishes this Board holds, shown after its name in the
// pill and on its row (as the Board module counts them, so it follows adds,
// deletes and polls at once); null while not known.
const props = defineProps<{ board: BoardNameAndEmoji, dishCount?: number | null }>()
const emit = defineEmits<{ settings: [] }>()
const t = useStrings()
const route = useRoute()

const open = ref(false)
const boards = useBoardListings()
const creating = ref(false)
const root = useTemplateRef<HTMLElement>('root')
const pill = useTemplateRef<HTMLButtonElement>('pill')
const panelId = useId()
const { data: me } = useMe()

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  boards.value = await $fetch<BoardListing[]>('/api/boards').catch(() => boards.value)
}

// Escape closes it, and only it (not also the Board's search).
function closeOnEscape(event: KeyboardEvent) {
  if (!open.value) return
  event.preventDefault()
  close({ refocus: true })
}

function close({ refocus = false } = {}) {
  if (!open.value) return
  open.value = false
  if (refocus) pill.value?.focus()
}

// It closes on Escape, on a press anywhere else, and once a Board is picked.
function onPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) close()
}
onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
watch(() => route.params.board, () => close())

// Shown at once, before the list first arrives: this Board. Its own row
// counts as its pill does, which may be ahead of the list fetched.
const count = computed(() => props.dishCount ?? null)
const shown = computed(() => boards.value.length
  ? boards.value.map(b => b.id === props.board.id && count.value !== null ? { ...b, dishCount: count.value } : b)
  : [{ ...props.board, isOwner: false, dishCount: count.value, members: [], columns: [] }])

function newBoard() {
  close()
  creating.value = true
}

// Focus goes back to the pill first, where closing the sheet returns it.
function openSettings() {
  close({ refocus: true })
  emit('settings')
}
</script>

<template>
  <div
    ref="root"
    class="relative min-w-0"
    @keydown.esc="closeOnEscape"
  >
    <!-- The mockup's pill (column-titles-ideen.png): the emoji in a round
         pebble, the name in the button type, a chevron. Filled in the
         Board's tint (main.css, .board-pill), its pebble on surface. -->
    <h1 class="text-button">
      <button
        ref="pill"
        type="button"
        class="board-pill flex h-11 max-w-full items-center gap-2 rounded-pill py-1 pl-1 pr-3 text-left active:scale-[.97] focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="t.boards.switcher(board.name, count)"
        :data-tooltip="t.boards.switch"
        :aria-expanded="open"
        :aria-controls="panelId"
        @click="toggle"
      >
        <!-- Only the name truncates: clipped to its line, a tall emoji (🍪)
             would lose its top and bottom. The name's line is taller than
             the button type's, so its descenders aren't clipped. The
             Dish count after it stays whole, quieter than the name. It is
             drawn by CSS, so the heading's text stays the Board's name;
             the button's label says it. -->
        <span
          aria-hidden="true"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-[20px] leading-none"
          data-emoji-pebble
        ><span>{{ board.emoji }}</span></span> <span class="truncate leading-[1.3]">{{ board.name }}</span><span
          v-if="count !== null"
          aria-hidden="true"
          class="dish-count -ml-1 shrink-0 leading-[1.3] opacity-70"
          :data-dish-count="t.boards.count(count)"
        />
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="chevron shrink-0 opacity-70"
          :class="{ flipped: open }"
        ><path d="M6 9l6 6 6-6" /></svg>
      </button>
    </h1>

    <Transition name="panel">
      <nav
        v-if="open"
        :id="panelId"
        :aria-label="t.boards.label"
        class="panel absolute left-0 top-full z-dialog mt-2 max-h-[calc(100dvh-6rem)] w-[min(360px,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-card bg-surface p-2 shadow-dialog"
      >
        <ul class="flex flex-col gap-1">
          <li
            v-for="(listed, index) in shown"
            :key="listed.id"
            class="row"
            :style="{ '--i': index }"
          >
            <NuxtLink
              :to="boardPath(listed)"
              :aria-current="listed.id === board.id ? 'page' : undefined"
              class="flex items-center gap-3 rounded-field px-2 py-2 transition-transform duration-tap ease-tap hover:bg-surface-muted active:scale-[.98] focus-visible:outline-2 focus-visible:outline-focus"
              @click="close()"
            >
              <span
                aria-hidden="true"
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-blob bg-surface-muted text-[24px]"
              >
                <span class="hop">{{ listed.emoji }}</span>
              </span>
              <span class="flex min-w-0 flex-1 items-baseline gap-1 text-button">
                <span class="truncate">{{ listed.name }}</span>
                <span
                  v-if="listed.dishCount !== null"
                  class="shrink-0 text-text-muted"
                  data-dish-count
                >{{ t.boards.count(listed.dishCount) }}</span>
              </span>
              <span
                v-if="listed.members.length"
                aria-hidden="true"
                class="flex shrink-0 -space-x-1.5"
              >
                <UserAvatar
                  v-for="member in listed.members.slice(0, 3)"
                  :key="member.id"
                  :name="member.name"
                  :image="member.image"
                  class="ring-2 ring-surface"
                />
              </span>
              <svg
                v-if="listed.id === board.id"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="shrink-0"
                role="img"
                :aria-label="t.boards.current"
              ><path d="M5 12l5 5 9-10" /></svg>
            </NuxtLink>
          </li>
          <li
            class="row"
            :style="{ '--i': shown.length }"
          >
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-field px-2 py-2 text-left text-button transition-transform duration-tap ease-tap hover:bg-surface-muted active:scale-[.98] focus-visible:outline-2 focus-visible:outline-focus"
              aria-haspopup="dialog"
              @click="newBoard"
            >
              <span
                aria-hidden="true"
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-blob border-2 border-dashed border-line-strong text-[22px] text-text-muted"
              >+</span>
              {{ t.boards.newBoard }}
            </button>
          </li>
          <li
            v-if="me"
            class="row mt-1 border-t border-line pt-1 tablet:hidden"
            :style="{ '--i': shown.length + 1 }"
          >
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-field px-2 py-2 text-left text-button transition-transform duration-tap ease-tap hover:bg-surface-muted active:scale-[.98] focus-visible:outline-2 focus-visible:outline-focus"
              aria-haspopup="dialog"
              @click="openSettings"
            >
              <UserAvatar
                :name="me.name"
                :image="me.image"
                :size="44"
              />
              {{ t.userSettings.open }}
            </button>
          </li>
          <li
            class="row tablet:hidden"
            :class="{ 'mt-1 border-t border-line pt-1': !me }"
            :style="{ '--i': shown.length + 2 }"
          >
            <LegalLinks @chosen="close({ refocus: true })" />
          </li>
        </ul>
      </nav>
    </Transition>

    <NewBoardSheet v-model:open="creating" />
  </div>
</template>

<style scoped>
.dish-count::before {
  content: attr(data-dish-count);
}
.chevron {
  transition: rotate var(--dur-tap) var(--ease-tap);
}
.chevron.flipped {
  rotate: 180deg;
}

/* Handoff: the panel pops from the pill (translateY(-16px) scale .96 → 1),
   its rows rise 14px, 50ms apart, and each emoji hops every 4s, 0.9s after
   the one above. Reduced motion: tokens.css zeroes the durations, and the
   emojis stay still. */
.panel {
  transform-origin: top left;
}
.panel-enter-active {
  transition: translate var(--dur-pop) var(--ease-pop), scale var(--dur-pop) var(--ease-pop), opacity var(--dur-fade) var(--ease-fade);
}
.panel-leave-active {
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.panel-enter-from {
  translate: 0 -16px;
  scale: .96;
  opacity: 0;
}
.panel-leave-to {
  opacity: 0;
}
.row {
  animation: row-rise var(--dur-pop) var(--ease-pop) backwards;
  animation-delay: calc(var(--i) * 50ms);
}
.hop {
  display: inline-block;
  animation: hop 4s var(--ease-idle) infinite;
  animation-delay: calc(var(--i) * 900ms);
}
@keyframes row-rise {
  from {
    translate: 0 14px;
    opacity: 0;
  }
}
@keyframes hop {
  0%, 8%, 100% { translate: 0 0; }
  4% { translate: 0 -5px; }
}
@media (prefers-reduced-motion: reduce) {
  .row,
  .hop {
    animation: none;
  }
}
</style>
