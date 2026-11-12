import type { PlanEntry } from '~/board/board-module'
import { dropIndex } from '~/utils/drop-index'

// Dragging Planned Dishes (handoff interactions.json "Drag a Planned Dish
// within a day" and "to another day"), the way Dishes are dragged between
// Columns (useDishDrag).
//
// A mouse on a `pointer: fine` device picks one up once it moves 4px; a
// finger, pen or any other pointer long-presses it for 300ms first (moving
// 8px before that is a scroll instead). It then follows the pointer, and a
// slot opens where it would land, the others making room. A day is a target
// when the pointer is over it: across the columns of the week from 1200px,
// down the list of days on a phone, where the day strip (DayStrip) shows
// meanwhile and a pebble in it takes the Planned Dish to the end of that
// day. Past days take nothing. Near the edges the page scrolls along.
//
// Letting go settles it into its slot (or back where it was), and only then
// is it moved, through `drop`. While `paused` or `pinned` (the Member may
// not move Dishes) nothing is picked up, and a press opens the Dish as ever.

export interface PlanDrag {
  entry: PlanEntry
  fromDay: string
  fromIndex: number
  // lifted: following the pointer. settling: flying into its slot.
  phase: 'lifted' | 'settling'
  x: number
  y: number
  width: number
  height: number
  grabX: number
  grabY: number
  // Degrees, from the pointer's sideways speed.
  tilt: number
  // Where it would land: `index` among the day's other Planned Dishes. Null
  // over nothing that takes it (a past day, between days): it goes back.
  over: { day: string, index: number } | null
  // Phones: the pointer is up by the day strip (the card shrinks so the strip
  // stays visible), and over this day's pebble, if any.
  nearStrip: boolean
  stripDay: string | null
}

// A Planned Dish in a day's list while dragging: itself, the dragged one's
// own place (`slot`, or `gone` while it is over another day), or the slot
// opening in another day.
export type PlanListEntry
  = | { key: string, entry: PlanEntry, state: 'card' | 'slot' | 'gone' }
    | { key: 'drop-slot', entry: null, state: 'drop-slot' }

const LONG_PRESS_MS = 300
const LONG_PRESS_SLOP = 8
const MOUSE_SLOP = 4
const EDGE = 64
const MAX_SCROLL_STEP = 12
// The week is a row of columns from this width (tailwind `desktop`).
const GRID = '(min-width: 1200px)'
// How far below the strip the pointer still counts as up by it.
const STRIP_ZONE = 40

export function useWeekDrag(
  surface: Readonly<Ref<HTMLElement | null>>,
  options: {
    // The Planned Dishes of a day, in order.
    entriesOf: (day: string) => PlanEntry[]
    isPast: (day: string) => boolean
    // The day strip's element, while shown (phones).
    strip: () => HTMLElement | null
    // `index`: among the day's other Planned Dishes; absent for the end.
    drop: (plannedId: string, day: string, index: number | undefined) => void
    paused?: () => boolean
    pinned?: () => boolean
  },
) {
  const drag = ref<PlanDrag | null>(null)
  // Right after a drag the card's click must not open the Dish.
  let swallowClick = false

  let pending: {
    pointerId: number
    plannedId: string
    card: HTMLElement
    mouse: boolean
    startX: number
    startY: number
    timer?: ReturnType<typeof setTimeout>
  } | null = null
  let pointer = { x: 0, y: 0, id: -1 }
  let samples: { x: number, t: number }[] = []
  let moved = false
  let frame = 0

  const grid = () => matchMedia(GRID).matches

  function onDown(event: PointerEvent) {
    if (drag.value || pending || !event.isPrimary || event.button !== 0 || options.paused?.() || options.pinned?.()) return
    const target = event.target as Element | null
    if (!target || target.closest('button')) return
    const card = target.closest<HTMLElement>('[data-planned-id]')
    if (!card?.dataset.plannedId) return
    const mouse = event.pointerType === 'mouse' && isFinePointer()
    pending = { pointerId: event.pointerId, plannedId: card.dataset.plannedId, card, mouse, startX: event.clientX, startY: event.clientY }
    pointer = { x: event.clientX, y: event.clientY, id: event.pointerId }
    if (!mouse) pending.timer = setTimeout(lift, LONG_PRESS_MS)
  }

  function onMove(event: PointerEvent) {
    if (event.pointerId !== pointer.id) return
    pointer = { ...pointer, x: event.clientX, y: event.clientY }
    if (pending) {
      const away = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY)
      if (pending.mouse && away >= MOUSE_SLOP) lift()
      else if (!pending.mouse && away >= LONG_PRESS_SLOP) cancelPending()
      return
    }
    const current = drag.value
    if (!current || current.phase !== 'lifted') return
    samples.push({ x: event.clientX, t: event.timeStamp })
    moved = true
    follow(current)
  }

  // Tilts with the pointer's sideways speed over the last 100ms (0.02° per
  // px/s, at most 3° either way), so it straightens once still.
  function tiltNow(): number {
    const now = performance.now()
    samples = samples.filter(s => now - s.t <= 100)
    const first = samples[0]
    const last = samples.at(-1)
    if (!first || !last || last.t === first.t) return 0
    const speed = (last.x - first.x) / (last.t - first.t) * 1000
    return Math.max(-3, Math.min(3, speed * 0.02))
  }

  function onUp(event: PointerEvent) {
    if (event.pointerId !== pointer.id) return
    if (pending) return cancelPending()
    if (drag.value?.phase === 'lifted') release()
  }

  function onCancel(event: PointerEvent) {
    if (event.pointerId !== pointer.id) return
    if (pending) return cancelPending()
    if (drag.value?.phase === 'lifted') putBack()
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape' && drag.value?.phase === 'lifted') putBack()
  }

  function cancelPending() {
    clearTimeout(pending?.timer)
    pending = null
  }

  function lift() {
    if (!pending) return
    const { plannedId, card, mouse } = pending
    cancelPending()
    const found = findEntry(plannedId)
    if (!found) return
    const box = card.getBoundingClientRect()
    drag.value = {
      entry: found.entry,
      fromDay: found.entry.day,
      fromIndex: found.index,
      phase: 'lifted',
      x: box.left,
      y: box.top,
      width: box.width,
      height: box.height,
      grabX: pointer.x - box.left,
      grabY: pointer.y - box.top,
      tilt: prefersReducedMotion() ? 0 : -2,
      over: { day: found.entry.day, index: found.index },
      nearStrip: false,
      stripDay: null,
    }
    samples = []
    moved = false
    swallowClick = true
    if (!mouse) hapticLongPress()
    frame = requestAnimationFrame(tick)
  }

  // The Planned Dish with this id, wherever the week shows it, and its place
  // in its day.
  function findEntry(plannedId: string): { entry: PlanEntry, index: number } | null {
    for (const day of days()) {
      const list = options.entriesOf(day)
      const index = list.findIndex(e => e.id === plannedId)
      if (index !== -1) return { entry: list[index]!, index }
    }
    return null
  }

  const days = () => [...surface.value?.querySelectorAll<HTMLElement>('[data-day]') ?? []].map(el => el.dataset.day!)

  // While dragging, a finger moves the card, not the page. The dragged
  // card's element stays in its list throughout, so its touches bubble here.
  // (Registered up front: a browser only lets a touch listener hold off
  // scrolling if it was there when the touch started.)
  function holdScroll(event: TouchEvent) {
    if (drag.value) event.preventDefault()
  }

  // A link or image would start the browser's own drag and drop instead.
  function onNativeDrag(event: DragEvent) {
    event.preventDefault()
  }

  function tick() {
    const current = drag.value
    if (!current || current.phase !== 'lifted') return
    if (moved && !prefersReducedMotion()) current.tilt = tiltNow()
    autoScroll(current)
    follow(current)
    frame = requestAnimationFrame(tick)
  }

  function follow(current: PlanDrag) {
    current.x = pointer.x - current.grabX
    current.y = pointer.y - current.grabY
    locate(current)
  }

  function locate(current: PlanDrag) {
    const strip = grid() ? null : options.strip()
    const stripBox = strip?.getBoundingClientRect()
    if (strip && stripBox && pointer.y >= stripBox.top && pointer.y < stripBox.bottom + STRIP_ZONE) {
      current.nearStrip = true
      const pebble = [...strip.querySelectorAll<HTMLElement>('[data-strip-day]')].find((el) => {
        const box = el.getBoundingClientRect()
        return pointer.x >= box.left && pointer.x <= box.right
      })
      const day = pebble?.dataset.stripDay ?? null
      const target = day && !options.isPast(day) ? day : null
      if (target && target !== current.stripDay) hapticActivate()
      current.stripDay = target
      current.over = target ? { day: target, index: options.entriesOf(target).filter(e => e.id !== current.entry.id).length } : null
      return
    }
    current.nearStrip = false
    current.stripDay = null

    const section = dayAt(pointer.x, pointer.y)
    const day = section?.dataset.day
    if (!section || !day || options.isPast(day)) {
      current.over = null
      return
    }
    // Back over the day it is in, the slot it has there holds on a little.
    const slot = current.over?.day === day ? current.over.index : null
    const index = indexIn(section, pointer.y - current.grabY + current.height / 2, current.entry.id, slot)
    if (current.over?.day !== day || current.over.index !== index) {
      current.over = { day, index }
      hapticTick()
    }
  }

  // The day under the pointer: across the columns from 1200px, down the list
  // of days on a phone.
  function dayAt(x: number, y: number): HTMLElement | null {
    const wide = grid()
    for (const el of surface.value?.querySelectorAll<HTMLElement>('[data-day]') ?? []) {
      const box = el.getBoundingClientRect()
      if (wide ? x >= box.left && x <= box.right : y >= box.top && y <= box.bottom + 8) return el
    }
    return null
  }

  // Where the dragged card, its middle at `middle`, goes among the day's
  // other cards (dropIndex, from its `slot` there if it has one). Measured as
  // the list would be without the slot, so the slot opening doesn't move the
  // goal.
  function indexIn(section: HTMLElement, middle: number, draggedId: string, slot: number | null): number {
    const list = section.querySelector<HTMLElement>('[data-planned-list]')
    if (!list) return 0
    const gap = Number.parseFloat(getComputedStyle(list).rowGap) || 0
    let top = list.getBoundingClientRect().top
    const middles: number[] = []
    for (const item of list.querySelectorAll<HTMLElement>(':scope > [data-planned-id]')) {
      if (item.dataset.plannedId === draggedId) continue
      middles.push(top + item.offsetHeight / 2)
      top += item.offsetHeight + gap
    }
    return dropIndex(middles, middle, slot)
  }

  function autoScroll(current: PlanDrag) {
    if (grid() || current.nearStrip) return
    const step = (into: number) => Math.min(MAX_SCROLL_STEP, Math.ceil(into / EDGE * MAX_SCROLL_STEP))
    if (pointer.y > innerHeight - EDGE) scrollBy(0, step(pointer.y - (innerHeight - EDGE)))
    else if (pointer.y < EDGE) scrollBy(0, -step(EDGE - pointer.y))
  }

  function stopFollowing() {
    cancelAnimationFrame(frame)
    setTimeout(() => (swallowClick = false), 400)
  }

  function release() {
    const current = drag.value
    if (!current) return
    stopFollowing()
    if (!current.over) return putBack()
    void settle(current)
  }

  function putBack() {
    const current = drag.value
    if (!current) return
    stopFollowing()
    current.over = { day: current.fromDay, index: current.fromIndex }
    current.stripDay = null
    void settle(current)
  }

  // The card flies into its slot, upright again, and lands there.
  async function settle(current: PlanDrag) {
    current.phase = 'settling'
    current.nearStrip = false
    current.stripDay = null
    current.tilt = 0
    await nextTick()
    const slot = surface.value?.querySelector<HTMLElement>(`[data-planned-id="${CSS.escape(current.entry.id)}"][data-drag-state="slot"], [data-drop-slot]`)
    const box = slot?.getBoundingClientRect()
    if (box) {
      current.x = box.left
      current.y = box.top
    }
    const ms = box ? motionMs('drop-settle') : 0
    setTimeout(() => land(current), ms)
  }

  function land(current: PlanDrag) {
    if (drag.value !== current) return
    const place = current.over
    // Back where it was: nothing to write.
    if (place && !(place.day === current.fromDay && place.index === current.fromIndex)) {
      // At the end of a day it is the same as no index: the module appends.
      const others = options.entriesOf(place.day).filter(e => e.id !== current.entry.id).length
      options.drop(current.entry.id, place.day, place.index >= others ? undefined : place.index)
    }
    drag.value = null
  }

  // A day's list as it shows while dragging: the dragged one's own place
  // moves to where it would land, or closes while it is over another day.
  function entries(day: string): PlanListEntry[] {
    const current = drag.value
    const cards = options.entriesOf(day).map(entry => ({ key: entry.id, entry, state: 'card' as const }))
    if (!current) return cards
    const others: PlanListEntry[] = cards.filter(e => e.entry.id !== current.entry.id)
    const here = current.over?.day === day
    const at = () => Math.min(current.over!.index, others.length)
    if (day === current.fromDay) {
      others.splice(here ? at() : Math.min(current.fromIndex, others.length), 0, { key: current.entry.id, entry: current.entry, state: here ? 'slot' : 'gone' })
    }
    else if (here) {
      others.splice(at(), 0, { key: 'drop-slot', entry: null, state: 'drop-slot' })
    }
    return others
  }

  function onClick(event: MouseEvent) {
    if (!swallowClick) return
    swallowClick = false
    event.preventDefault()
    event.stopPropagation()
  }

  // A long-press must not bring up the browser's own menu for the link.
  function onContextMenu(event: Event) {
    if (pending || drag.value) event.preventDefault()
  }

  const onWindow = [['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onCancel], ['keydown', onKey]] as const
  let bound: HTMLElement | null = null
  onMounted(() => {
    bound = surface.value
    bound?.addEventListener('pointerdown', onDown)
    bound?.addEventListener('click', onClick, { capture: true })
    bound?.addEventListener('contextmenu', onContextMenu)
    bound?.addEventListener('dragstart', onNativeDrag)
    bound?.addEventListener('touchmove', holdScroll, { passive: false })
    for (const [type, listener] of onWindow) window.addEventListener(type, listener as EventListener)
  })
  onBeforeUnmount(() => {
    cancelPending()
    stopFollowing()
    bound?.removeEventListener('pointerdown', onDown)
    bound?.removeEventListener('click', onClick, { capture: true })
    bound?.removeEventListener('contextmenu', onContextMenu)
    bound?.removeEventListener('dragstart', onNativeDrag)
    bound?.removeEventListener('touchmove', holdScroll)
    for (const [type, listener] of onWindow) window.removeEventListener(type, listener as EventListener)
  })

  const dragging = computed(() => drag.value !== null)

  return { drag, dragging, entries }
}
