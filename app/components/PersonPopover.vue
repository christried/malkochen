<script setup lang="ts">
import type { PersonCard } from '~~/server/utils/person-card'

// The user popover (#213): a button on someone's Profile Picture (a Dish
// card's, CardPersonButton; the Dish detail's "Hinzugefügt von …" line)
// that opens a small card about them: their Username (never their Google
// name), a large Profile Picture, since when they are on malkochen, how many
// Dishes they added to this Board, and the Boards the viewer shares with
// them. No cooking numbers.
//
// Under a mouse it opens once the pointer has rested on the button for
// OPEN_MS, and closes once the pointer has left both the button and the
// popover (CLOSE_MS of grace to cross the gap between them). A tap (or a
// click, or Enter) opens it at once; a tap on the button again, or anywhere
// outside it, closes it, and so does Escape, before anything else Escape
// would close (the Dish detail). Only one shows at a time.
//
// It is a manual popover in the top layer, shown from where its button is:
// inside the Dish detail's <dialog>, so above it and not made inert by it.
// Pressing in it starts no drag and opens no Dish (the card's handlers
// below never see it).
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  person: { id: string, name: string, image: string | null }
  boardId: string
}>()
const t = useStrings()
const route = useRoute()

const OPEN_MS = 300
const CLOSE_MS = 200
// From the button, and from the screen's edges.
const GAP = 8
const EDGE = 8

const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const panel = useTemplateRef<HTMLElement>('panel')
const panelId = useId()
const titleId = useId()
const open = ref(false)
const card = ref<PersonCard | null>(null)
const failed = ref(false)

let openTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined
// Placed anew as it grows, once what was loaded shows.
let resized: ResizeObserver | undefined

const key = () => `${props.boardId}:${props.person.id}`

async function load() {
  const wanted = key()
  card.value = cards.get(wanted) ?? null
  failed.value = false
  try {
    const found = await $fetch<PersonCard>(`/api/boards/${props.boardId}/people/${props.person.id}`)
    cards.set(wanted, found)
    if (key() === wanted) card.value = found
  }
  catch {
    if (key() === wanted && !card.value) failed.value = true
  }
}

async function show() {
  clearTimeout(openTimer)
  clearTimeout(closeTimer)
  if (open.value) return
  closeOther?.()
  closeOther = hide
  open.value = true
  void load()
  await nextTick()
  if (!open.value || !panel.value || !trigger.value?.isConnected) return
  panel.value.showPopover()
  place()
  resized = new ResizeObserver(place)
  resized.observe(panel.value)
}

function hide() {
  clearTimeout(openTimer)
  clearTimeout(closeTimer)
  if (closeOther === hide) closeOther = null
  resized?.disconnect()
  resized = undefined
  if (!open.value) return
  open.value = false
  if (panel.value?.matches(':popover-open')) panel.value.hidePopover()
}

// Below the button, or above it where there is no room below, and kept on
// the screen; gone with a button that has left the screen.
function place() {
  const el = panel.value
  const anchor = trigger.value
  if (!el || !anchor || !open.value) return
  const box = anchor.getBoundingClientRect()
  if (!anchor.isConnected || box.bottom < 0 || box.top > innerHeight || box.right < 0 || box.left > innerWidth) {
    hide()
    return
  }
  const { offsetWidth: width, offsetHeight: height } = el
  const above = box.bottom + GAP + height > innerHeight - EDGE && box.top - GAP - height >= EDGE
  const left = Math.max(EDGE, Math.min(box.left + box.width / 2 - width / 2, innerWidth - EDGE - width))
  el.style.left = `${left}px`
  el.style.top = `${above ? box.top - GAP - height : box.bottom + GAP}px`
  el.dataset.above = String(above)
}

const isMouse = (event: PointerEvent) => event.pointerType === 'mouse'

function onEnter(event: PointerEvent) {
  if (!isMouse(event)) return
  clearTimeout(closeTimer)
  if (!open.value && !event.buttons) openTimer = setTimeout(() => void show(), OPEN_MS)
}

function onLeave(event: PointerEvent) {
  if (!isMouse(event)) return
  clearTimeout(openTimer)
  if (open.value) closeTimer = setTimeout(hide, CLOSE_MS)
}

// A mouse's click opens it (if resting there hasn't already); a tap, a
// pen or Enter opens or closes it.
function onClick(event: MouseEvent) {
  const mouse = event instanceof PointerEvent && event.pointerType === 'mouse'
  if (open.value && !mouse) hide()
  else void show()
}

// A press anywhere but on the button or the popover closes it.
function onPressAnywhere(event: PointerEvent) {
  const target = event.target as Node | null
  if (!open.value || !target) return
  if (trigger.value?.contains(target) || panel.value?.contains(target)) return
  hide()
}

// Escape closes it first, and nothing else (the Dish detail behind it, the
// Board's search): the window's capture sees the key before anyone.
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value) return
  event.preventDefault()
  event.stopImmediatePropagation()
  hide()
}

onMounted(() => {
  document.addEventListener('pointerdown', onPressAnywhere, true)
  window.addEventListener('keydown', onKeydown, true)
  document.addEventListener('scroll', place, { capture: true, passive: true })
  window.addEventListener('resize', place)
})
onBeforeUnmount(() => {
  hide()
  document.removeEventListener('pointerdown', onPressAnywhere, true)
  window.removeEventListener('keydown', onKeydown, true)
  document.removeEventListener('scroll', place, { capture: true })
  window.removeEventListener('resize', place)
})
watch(() => route.fullPath, hide)

const boardsLabel = computed(() => card.value?.isYou ? t.person.ownBoards : t.person.sharedBoards)
</script>

<script lang="ts">
// What was last loaded about someone, per Board: shown at once when their
// popover opens again, while it is asked anew.
const cards = new Map<string, PersonCard>()
// The popover that shows, so that opening another closes it.
let closeOther: (() => void) | null = null
</script>

<template>
  <button
    ref="trigger"
    type="button"
    v-bind="$attrs"
    aria-haspopup="dialog"
    :aria-expanded="open"
    :aria-controls="open ? panelId : undefined"
    data-person-button
    @pointerenter="onEnter"
    @pointerleave="onLeave"
    @click="onClick"
  >
    <slot />
  </button>
  <div
    v-if="open"
    :id="panelId"
    ref="panel"
    popover="manual"
    role="dialog"
    :aria-labelledby="titleId"
    class="person-popover rounded-panel bg-surface p-4 text-left text-text shadow-dialog"
    data-person-popover
    @pointerenter="onEnter"
    @pointerleave="onLeave"
    @pointerdown.stop
    @click.stop
  >
    <div class="flex items-center gap-3">
      <UserAvatar
        :name="card?.name ?? person.name"
        :image="card ? card.image : person.image"
        :size="64"
        data-person-picture
      />
      <div class="min-w-0">
        <p
          :id="titleId"
          class="truncate font-display text-title-m"
        >
          {{ card?.name ?? person.name }}
        </p>
        <p
          v-if="card"
          class="text-small text-text-muted"
          data-person-since
        >
          {{ t.person.since(new Date(card.memberSince)) }}
        </p>
      </div>
    </div>
    <template v-if="card">
      <p
        class="mt-3 text-small"
        data-person-dishes
      >
        {{ t.person.dishesAdded(card.dishesAdded) }}
      </p>
      <p
        :id="`${panelId}-boards`"
        class="mt-3 text-overline uppercase text-text-muted"
      >
        {{ boardsLabel }}
      </p>
      <ul
        class="mt-1 flex flex-col gap-0.5 text-small"
        :aria-labelledby="`${panelId}-boards`"
        data-person-boards
      >
        <li
          v-for="shared in card.sharedBoards"
          :key="shared.id"
          class="truncate"
        >
          <span aria-hidden="true">{{ shared.emoji }}</span> {{ shared.name }}
        </li>
      </ul>
    </template>
    <p
      v-else-if="!failed"
      class="mt-3 flex items-center gap-2 text-small text-text-muted"
    >
      <LoadingDots />
      <span>{{ t.person.loading }}</span>
    </p>
  </div>
</template>

<style scoped>
/* Placed by script. It fades in, moving 4px toward its place, as the
   Tooltip does; reduced motion: it only fades. */
.person-popover {
  position: fixed;
  inset: auto;
  margin: 0;
  border: 0;
  width: 260px;
  max-width: calc(100vw - 16px);
}
.person-popover:popover-open {
  animation: person-in var(--dur-fade) var(--ease-fade);
}
.person-popover[data-above="true"]:popover-open {
  animation-name: person-in-above;
}
@keyframes person-in {
  from {
    opacity: 0;
    translate: 0 -4px;
  }
}
@keyframes person-in-above {
  from {
    opacity: 0;
    translate: 0 4px;
  }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes person-in {
    from {
      opacity: 0;
    }
  }
  @keyframes person-in-above {
    from {
      opacity: 0;
    }
  }
}
</style>
