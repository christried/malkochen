import type { BoardView } from '~~/server/utils/boards'
import type { DishView } from '~~/server/utils/dishes'
import { dishOnBoard } from '~~/shared/board'
import { landingIndex, recordsCooking } from '~~/shared/placement'

// Dragging Dishes (PRD stories 31, 32, 34, 79; handoff interactions.json
// "Drag lift" and "Drop target (tab / lane)").
//
// A mouse on a `pointer: fine` device picks a card up once it moves 4px; a
// finger, pen or any other pointer long-presses it for 300ms first (moving
// 8px before that is a scroll or a swipe instead). The card then follows the
// pointer, and a slot opens where it would land, the other cards making room.
// Phones reorder within the shown Column, or drop onto a Column tab, which
// puts the Dish at the top of that Column. From 768px it can go across lanes.
// Near the edges the page (and the lanes) scroll along.
//
// Letting go settles the card into its slot, or swallows it into the tab,
// and only then is it moved, through `drop`. A finger that long-presses a
// card and lets go without moving it selects the card instead (`press`,
// #218): the card settles back. While `paused` (Dishes are selected),
// nothing is picked up.

// Where the dragged card would land: `index` among the Column's other Dishes.
export interface DropPlace {
  columnId: string
  index: number
}

export interface DishDrag {
  dish: DishView
  fromColumnId: string
  fromIndex: number
  // lifted: following the pointer. settling: flying into its slot.
  // swallowing: flying into a Column tab (phones).
  phase: 'lifted' | 'settling' | 'swallowing'
  // The card's box in the viewport, and where it was grabbed within it.
  x: number
  y: number
  width: number
  height: number
  grabX: number
  grabY: number
  // Degrees, from the pointer's sideways speed.
  tilt: number
  over: DropPlace
  // Phones: the pointer is up by the Column tabs (the card shrinks so they
  // stay visible), and over this Column's tab, if any.
  nearTabs: boolean
  tabColumnId: string | null
  // From 768px: the lane it is over, if not its own.
  laneColumnId: string | null
}

// A card in a Column's list while dragging: a Dish, the dragged card's own
// place (`slot`, or `gone` while it is over another Column), or the slot
// opening in another Column.
export type DragEntry
  = | { key: string, dish: DishView, state: 'card' | 'slot' | 'gone' }
    | { key: 'drop-slot', dish: null, state: 'drop-slot' }

const LONG_PRESS_MS = 300
const LONG_PRESS_SLOP = 8
const MOUSE_SLOP = 4
// Phones: how far below the tabs the pointer still counts as up by them.
const TAB_ZONE = 60
const EDGE = 60
const MAX_SCROLL_STEP = 16

export function useDishDrag(
  surface: Readonly<Ref<HTMLElement | null>>,
  options: {
    board: () => BoardView | undefined
    // Phones: the Column shown.
    activeColumnId: () => string | undefined
    tabBar: () => HTMLElement | null
    // `at`: the centre of where it landed (a Gekocht drop celebrates there).
    drop: (dishId: string, place: DropPlace, at: Point) => void
    // A card went into a Column tab (phones), for the tab to react.
    landed: (columnId: string) => void
    // A long-press let go where it started.
    press?: (dishId: string) => void
    paused?: () => boolean
  },
) {
  const drag = ref<DishDrag | null>(null)
  // Right after a drag the card's click must not open the Dish.
  let swallowClick = false

  let pending: {
    pointerId: number
    dishId: string
    card: HTMLElement
    mouse: boolean
    startX: number
    startY: number
    timer?: ReturnType<typeof setTimeout>
  } | null = null
  let pointer = { x: 0, y: 0, id: -1 }
  let samples: { x: number, t: number }[] = []
  // Whether the lifted card has moved yet: until then it keeps the lift's tilt.
  let moved = false
  // Where a finger's long-press lifted the card, until the finger moves away
  // from there (null for a mouse): letting go before that selects the card.
  let pressedAt: { x: number, y: number } | null = null
  let frame = 0

  function onDown(event: PointerEvent) {
    if (drag.value || pending || !event.isPrimary || event.button !== 0 || options.paused?.()) return
    const target = event.target as Element | null
    if (!target || target.closest('button')) return
    const card = target.closest<HTMLElement>('[data-dish-id]')
    if (!card?.dataset.dishId) return
    const mouse = event.pointerType === 'mouse' && isFinePointer()
    pending = { pointerId: event.pointerId, dishId: card.dataset.dishId, card, mouse, startX: event.clientX, startY: event.clientY }
    pointer = { x: event.clientX, y: event.clientY, id: event.pointerId }
    if (!mouse) pending.timer = setTimeout(() => lift(), LONG_PRESS_MS)
  }

  function onMove(event: PointerEvent) {
    if (event.pointerId !== pointer.id) return
    pointer = { ...pointer, x: event.clientX, y: event.clientY }
    if (pending) {
      const moved = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY)
      if (pending.mouse && moved >= MOUSE_SLOP) lift()
      else if (!pending.mouse && moved >= LONG_PRESS_SLOP) cancelPending()
      return
    }
    const current = drag.value
    if (!current || current.phase !== 'lifted') return
    samples.push({ x: event.clientX, t: event.timeStamp })
    moved = true
    // Dragged away, it is a drag, even if it comes back to where it started.
    if (pressedAt && Math.hypot(pointer.x - pressedAt.x, pointer.y - pressedAt.y) >= LONG_PRESS_SLOP) pressedAt = null
    follow(current)
  }

  // The card tilts with the pointer's sideways speed over the last 100ms
  // (0.02° per px/s, at most 3° either way), so it straightens once still.
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
    const { dishId, card, mouse } = pending
    cancelPending()
    const board = options.board()
    const found = board && dishOnBoard(board, dishId)
    if (!found) return
    const box = card.getBoundingClientRect()
    const fromIndex = found.column.dishes.indexOf(found.dish)
    drag.value = {
      dish: found.dish,
      fromColumnId: found.column.id,
      fromIndex,
      phase: 'lifted',
      x: box.left,
      y: box.top,
      width: box.width,
      height: box.height,
      grabX: pointer.x - box.left,
      grabY: pointer.y - box.top,
      tilt: prefersReducedMotion() ? 0 : -2,
      over: { columnId: found.column.id, index: fromIndex },
      nearTabs: false,
      tabColumnId: null,
      laneColumnId: null,
    }
    samples = []
    moved = false
    pressedAt = mouse ? null : { x: pointer.x, y: pointer.y }
    swallowClick = true
    if (!mouse) hapticLongPress()
    frame = requestAnimationFrame(tick)
  }

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

  // Every frame: scroll near the edges, then find where the card would land
  // (the page may have moved under a still pointer).
  function tick() {
    const current = drag.value
    if (!current || current.phase !== 'lifted') return
    // Lifting tilts it to -2°; from the first move on, speed decides.
    if (moved && !prefersReducedMotion()) current.tilt = tiltNow()
    autoScroll(current)
    follow(current)
    frame = requestAnimationFrame(tick)
  }

  function follow(current: DishDrag) {
    current.x = pointer.x - current.grabX
    current.y = pointer.y - current.grabY
    locate(current)
  }

  // Phones: the band from the top of the Column tabs to 60px below them,
  // where a dragged card is up by the tabs.
  function tabZone(): { top: number, bottom: number } | null {
    const box = isPhoneLayout() ? options.tabBar()?.getBoundingClientRect() : undefined
    return box ? { top: box.top, bottom: box.bottom + TAB_ZONE } : null
  }

  // The element whose box spans `x`, if any.
  function spanning(elements: Iterable<HTMLElement>, x: number): HTMLElement | null {
    for (const el of elements) {
      const box = el.getBoundingClientRect()
      if (x >= box.left && x <= box.right) return el
    }
    return null
  }

  function locate(current: DishDrag) {
    const phone = isPhoneLayout()
    const zone = tabZone()
    if (zone && pointer.y >= zone.top && pointer.y < zone.bottom) {
      current.nearTabs = true
      const tabs = options.tabBar()?.querySelectorAll<HTMLElement>('[data-tab-column-id]') ?? []
      const tabColumnId = spanning(tabs, pointer.x)?.dataset.tabColumnId ?? null
      if (tabColumnId && tabColumnId !== current.tabColumnId) hapticActivate()
      current.tabColumnId = tabColumnId
      return
    }
    current.nearTabs = false
    current.tabColumnId = null

    const section = phone ? columnSection(options.activeColumnId()) : laneAt(pointer.x)
    const columnId = section?.dataset.columnId
    if (!section || !columnId) return
    // Back over the Column it is in, the slot it has there holds on a little.
    const slot = current.over.columnId === columnId ? current.over.index : null
    const index = indexIn(section, pointer.y - current.grabY + current.height / 2, current.dish.id, slot)
    // Lanes have no haptic of their own (handoff: n/a on desktop).
    current.laneColumnId = phone || columnId === current.fromColumnId ? null : columnId
    if (columnId !== current.over.columnId || index !== current.over.index) {
      current.over = { columnId, index }
      hapticTick()
    }
  }

  function columnSection(columnId: string | undefined) {
    return columnId ? surface.value?.querySelector<HTMLElement>(`[data-column-id="${columnId}"]`) ?? null : null
  }

  function laneAt(x: number) {
    return spanning(surface.value?.querySelectorAll<HTMLElement>('[data-column-id]') ?? [], x)
  }

  // Where the dragged card, its middle at `middle`, goes among the Column's
  // other cards (dropIndex, from its `slot` there if it has one). Measured as
  // the list would be without the slot, so the slot opening doesn't move the
  // goal.
  function indexIn(section: HTMLElement, middle: number, draggedId: string, slot: number | null): number {
    const list = section.querySelector<HTMLElement>('[data-dish-list]')
    if (!list) return 0
    const gap = Number.parseFloat(getComputedStyle(list).rowGap) || 0
    let top = list.getBoundingClientRect().top
    const middles: number[] = []
    for (const item of list.querySelectorAll<HTMLElement>(':scope > [data-dish-id]')) {
      if (item.dataset.dishId === draggedId) continue
      middles.push(top + item.offsetHeight / 2)
      top += item.offsetHeight + gap
    }
    return dropIndex(middles, middle, slot)
  }

  function autoScroll(current: DishDrag) {
    const step = (into: number) => Math.min(MAX_SCROLL_STEP, Math.ceil(into / EDGE * MAX_SCROLL_STEP))
    if (pointer.y > innerHeight - EDGE) {
      scrollBy(0, step(pointer.y - (innerHeight - EDGE)))
    }
    else {
      // On phones the top edge is the tabs; the band just below them scrolls.
      const topEdge = tabZone()?.bottom ?? 0
      if (!current.nearTabs && pointer.y < topEdge + EDGE) scrollBy(0, -step(topEdge + EDGE - pointer.y))
    }
    const lanes = surface.value
    if (!lanes || isPhoneLayout()) return
    const box = lanes.getBoundingClientRect()
    if (pointer.x > box.right - EDGE) lanes.scrollLeft += step(pointer.x - (box.right - EDGE))
    else if (pointer.x < box.left + EDGE) lanes.scrollLeft -= step(box.left + EDGE - pointer.x)
  }

  function stopFollowing() {
    cancelAnimationFrame(frame)
    setTimeout(() => (swallowClick = false), 400)
  }

  function release() {
    const current = drag.value
    if (!current) return
    stopFollowing()
    if (pressedAt) {
      putBack()
      return options.press?.(current.dish.id)
    }
    if (current.nearTabs && current.tabColumnId) {
      if (current.tabColumnId === current.fromColumnId) {
        current.over = { columnId: current.fromColumnId, index: 0 }
        return settle(current)
      }
      return swallow(current, current.tabColumnId)
    }
    settle(current)
  }

  function putBack() {
    const current = drag.value
    if (!current) return
    stopFollowing()
    current.over = { columnId: current.fromColumnId, index: current.fromIndex }
    settle(current)
  }

  // The card flies into its slot, upright again, and lands there.
  async function settle(current: DishDrag) {
    current.phase = 'settling'
    current.nearTabs = false
    current.tabColumnId = null
    current.laneColumnId = null
    current.tilt = 0
    await nextTick()
    const slot = surface.value?.querySelector<HTMLElement>(`[data-dish-id="${current.dish.id}"][data-drag-state="slot"], [data-drop-slot]`)
    const box = slot?.getBoundingClientRect()
    if (box) {
      current.x = box.left
      current.y = box.top
    }
    const ms = box ? motionMs('drop-settle') : 0
    setTimeout(() => land(current, current.over, box), ms)
  }

  // Phones: the card shrinks into the Column tab, spinning, and goes to the
  // top of that Column.
  function swallow(current: DishDrag, columnId: string) {
    current.phase = 'swallowing'
    const tab = options.tabBar()?.querySelector<HTMLElement>(`[data-tab-column-id="${columnId}"]`)
    const box = tab?.getBoundingClientRect()
    if (box) {
      // It shrinks around where it was grabbed, so that point goes to the tab.
      current.x = box.left + box.width / 2 - current.grabX
      current.y = box.top + box.height / 2 - current.grabY
    }
    const ms = prefersReducedMotion() ? motionMs('fade') : motionMs('drop-swallow')
    // Recording a Cooking, the celebration has its own haptics, which would
    // cut this one off.
    const target = options.board()?.columns.find(c => c.id === columnId)
    const cooks = target && recordsCooking({ id: current.fromColumnId }, target)
    setTimeout(() => {
      if (!cooks) hapticConfirm()
      options.landed(columnId)
      land(current, { columnId, index: 0 }, box)
    }, ms)
  }

  // Without its slot or tab to measure, it lands where the card is.
  function land(current: DishDrag, place: DropPlace, box: DOMRect | undefined) {
    if (drag.value !== current) return
    const at = box ? centreOf(box) : { x: current.x + current.width / 2, y: current.y + current.grabY }
    options.drop(current.dish.id, place, at)
    drag.value = null
  }

  // The cards of a Column as they show while dragging: the dragged one's
  // own place moves to where it would land, or closes while it is elsewhere.
  function entries(column: { id: string, dishes: DishView[] }): DragEntry[] {
    const current = drag.value
    const cards = column.dishes.map(dish => ({ key: dish.id, dish, state: 'card' as const }))
    if (!current) return cards
    const others: DragEntry[] = cards.filter(e => e.dish !== current.dish)
    const here = current.over.columnId === column.id && current.phase !== 'swallowing'
    const lands = () => landingIndex(column, current.dish.id, current.over.index)
    if (column.id === current.fromColumnId) {
      // Swallowed into a tab, it closes where its slot was.
      const at = current.over.columnId === column.id ? lands() : Math.min(current.fromIndex, others.length)
      others.splice(at, 0, { key: current.dish.id, dish: current.dish, state: here ? 'slot' : 'gone' })
    }
    else if (here) {
      others.splice(lands(), 0, { key: 'drop-slot', dish: null, state: 'drop-slot' })
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
