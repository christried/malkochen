import type { Permissions } from '../../shared/permissions'
import type { Strings } from '../strings/de'
import type { TourCorner } from '../utils/tour-placement'

// The Tour (CONTEXT.md, #296): Topfbert's short walk through a Board. This is
// its brain, a step machine that knows nothing of the page: the situation it
// starts in, the user's choices and what happened on the Board go in, the
// step to show comes out (what it spotlights, by its `data-tour` name;
// Topfbert's pose and where he faces; its words and buttons), and whether it
// still runs. The Board's BoardTour feeds it and TourLayer draws what it
// answers.

// The Tour's version. A user who finished or skipped a lower one (or none)
// gets this one once; raising it shows the next Tour to everyone again.
export const TOUR_VERSION = 1

// How long the Board stays idle before the Tour, or the Changelog Popup,
// shows by itself: its cards have risen in by then.
export const SETTLE_MS = 1200

// What a step spotlights: the elements marked `data-tour="<name>"`. 'dish'
// is a Dish's card and 'dish-menu' its ⋯, the one with the step's `dishId`;
// 'column' is a Column's tab (phones) or lane, and 'menu-column' its choice
// in the ⋯ menu's "Verschieben nach…", the one with the step's `columnId`.
// 'menu-move' and 'menu-delete' are the ⋯ menu's two choices.
export type TourTarget = 'add-button' | 'add-dish-link' | 'dish' | 'dish-menu' | 'column' | 'menu-move' | 'menu-column' | 'menu-delete' | 'columns' | 'board-switcher'
export type TourPose = 'waving' | 'pointing' | 'wink'
// Pointing, Topfbert faces what he points at; otherwise the user.
export type TourFacing = 'target' | 'front'
// 'withoutDish': "Ohne Gericht weiter", past the steps about adding a Dish.
// 'install': the browser's own install dialog. 'keep': "Behalten", past
// deleting the Tour's Dish.
export type TourButton = 'back' | 'next' | 'finish' | 'skip' | 'withoutDish' | 'install' | 'keep'
// The Tour's steps in its order. 'columns' shows as 'moveDish' while the
// Tour's Dish is to be moved to the next Column, else it just explains the
// Columns. The last, on phones only, shows as one of three as it comes
// (tourStep): 'shareTip' (installed), 'install' (the browser offered
// installing) or 'installHow' (it didn't: where its menu has it).
export type TourSlot = 'hello' | 'addButton' | 'addDishLink' | 'newCard' | 'columns' | 'deleteDish' | 'boardSwitcher' | 'last'
export type TourStepId = Exclude<TourSlot, 'last'> | 'moveDish' | 'shareTip' | 'install' | 'installHow'
// The Tour's Dish's ⋯ menu: closed, showing its choices, or showing the
// Columns of "Verschieben nach…".
export type TourDishMenu = 'closed' | 'actions' | 'columns'
// The browser family, read from the user agent (tourBrowser).
export type TourBrowser = 'chrome' | 'samsung' | 'edge' | 'firefox' | 'other'

// Whether malkochen runs installed (display-mode: standalone), whether the
// browser offered installing it (beforeinstallprompt), and which browser.
export interface TourInstall {
  installed: boolean
  offered: boolean
  browser: TourBrowser
}

export interface TourColumn {
  id: string
  name: string
  isGekocht: boolean
}

// What the Tour starts in.
export interface TourSituation {
  // Phones show one Column at a time; larger layouts all side by side.
  layout: 'phone' | 'larger'
  // The Board's Columns, in their order.
  columns: TourColumn[]
  // The targets on the page once the Board is idle. A step whose target
  // isn't there is left out.
  targets: readonly TourTarget[]
  // The user's Permissions on the Board (#343). Without "add Dishes" the
  // Dish steps are left out; without "move Dishes" step 5 only explains
  // the Columns. Deleting the Tour's Dish needs no "archive Dishes": a
  // Member may always archive the Dishes they added themselves.
  permissions: Permissions
  install: TourInstall
}

export type TourEvent
  = | { type: 'next' } | { type: 'back' } | { type: 'skip' } | { type: 'withoutDish' }
    | { type: 'keep' }
  // What happened on the Board: Add Dish opened or closed, a Dish added (by
  // its id, from the client Board module's result, and the Column it
  // landed in); a Dish now in a Column (moved there, or back on the Board),
  // or gone from it (deleted, or moved to another Board); a Dish's ⋯ menu;
  // the Board's Columns changed (renamed, reordered, added or deleted).
    | { type: 'addDishOpened' } | { type: 'addDishClosed' } | { type: 'dishAdded', dishId: string, columnId: string }
    | { type: 'dishMoved', dishId: string, columnId: string } | { type: 'dishGone', dishId: string }
    | { type: 'dishMenu', dishId: string, menu: TourDishMenu }
    | { type: 'columnsChanged', columns: TourColumn[] }
  // The browser offered installing (beforeinstallprompt), and the user
  // answered its install dialog, either way.
    | { type: 'installOffered' } | { type: 'installAnswered' }

export interface Tour {
  status: 'running' | 'finished' | 'skipped'
  situation: TourSituation
  // The steps this Tour shows, in order, and the one showing.
  steps: TourSlot[]
  at: number
  // The Dish the user added during the Tour; null before, or without one.
  dishId: string | null
  // The Column it landed in, the one it's in now (null once it's gone from
  // the Board), its ⋯ menu, and whether the user chose to keep it.
  landedIn: string | null
  dishIn: string | null
  dishMenu: TourDishMenu
  kept: boolean
}

export interface TourStep {
  id: TourStepId
  target: TourTarget | null
  // A second target spotlit with it (the Column to move a Dish to).
  also: TourTarget | null
  // The Dish whose card the target is, and the Column a Column target is.
  dishId: string | null
  columnId: string | null
  // Without a target: the corner Topfbert points to (a browser's menu).
  corner: TourCorner | null
  // The user does something to the target and the step moves on once they
  // have: taps on the target reach it, and once it's gone (the user is busy
  // with what it opened) the bubble steps aside.
  handsOn: boolean
  // The page behind stays live: the target can be dragged, not just tapped.
  live: boolean
  pose: TourPose
  faces: TourFacing
  title: string
  text: string
  buttons: TourButton[]
}

// Every step, in the order they show: what it spotlights, and the target on
// the page it can't do without (the Dish steps all start at the add button),
// and the Permission it asks for.
const STEPS: { id: TourSlot, target: TourTarget | null, needs: TourTarget | null, permission?: keyof Permissions }[] = [
  { id: 'hello', target: null, needs: null },
  { id: 'addButton', target: 'add-button', needs: 'add-button', permission: 'addDishes' },
  { id: 'addDishLink', target: 'add-dish-link', needs: 'add-button', permission: 'addDishes' },
  { id: 'newCard', target: 'dish', needs: 'add-button', permission: 'addDishes' },
  { id: 'columns', target: 'columns', needs: 'columns' },
  { id: 'deleteDish', target: 'dish-menu', needs: 'add-button', permission: 'addDishes' },
  { id: 'boardSwitcher', target: 'board-switcher', needs: 'board-switcher' },
  // Which of three it shows is picked as it comes: installing can be
  // offered meanwhile.
  { id: 'last', target: null, needs: null },
]
// The steps about adding a Dish, which "Ohne Gericht weiter" goes past.
const DISH_STEPS: TourSlot[] = ['addButton', 'addDishLink', 'newCard', 'deleteDish']

export function startTour(situation: TourSituation): Tour {
  const steps = STEPS
    .filter(s => !s.needs || situation.targets.includes(s.needs))
    .filter(s => !s.permission || situation.permissions[s.permission])
    .filter(s => s.id !== 'last' || situation.layout === 'phone')
    .map(s => s.id)
  return { status: 'running', situation, steps, at: 0, dishId: null, landedIn: null, dishIn: null, dishMenu: 'closed', kept: false }
}

// The Tour after `event`. An ended Tour stays as it ended, and an event a
// step has no use for changes nothing.
export function tourAfter(tour: Tour, event: TourEvent): Tour {
  if (tour.status !== 'running') return tour
  const id = tour.steps[tour.at]!
  const to = (step: TourSlot, change: Partial<Tour> = {}): Tour => ({ ...tour, ...change, at: tour.steps.indexOf(step) })
  switch (event.type) {
    case 'skip':
      return { ...tour, status: 'skipped' }
    case 'back':
      return canGoBack(tour) ? { ...tour, at: backFrom(tour) } : tour
    case 'next':
      return waiting(tour) ? tour : forward(tour)
    case 'withoutDish': {
      if (id !== 'addButton' && id !== 'addDishLink') return tour
      const past = tour.steps.findIndex(s => s !== 'hello' && !DISH_STEPS.includes(s))
      return past < 0 ? { ...tour, status: 'finished' } : { ...tour, at: past }
    }
    case 'addDishOpened':
      return id === 'addButton' ? to('addDishLink') : tour
    case 'addDishClosed':
      return id === 'addDishLink' ? to('addButton') : tour
    case 'dishAdded':
      return id === 'addDishLink' ? to('newCard', { dishId: event.dishId, landedIn: event.columnId, dishIn: event.columnId }) : tour
    // Arrived in the Column step 5 asks for, or gone while a step was about
    // it, the Tour moves on; anything else is just where the Dish is now.
    case 'dishMoved':
    case 'dishGone': {
      if (event.dishId !== tour.dishId) return tour
      const asked = moveTo(tour)
      const aboutDish = !!asked || id === 'deleteDish'
      // Moved through the ⋯ menu, it has closed by then.
      if (event.type === 'dishMoved') {
        const placed: Tour = { ...tour, dishIn: event.columnId }
        return event.columnId === asked?.id ? forward({ ...placed, dishMenu: 'closed' }) : placed
      }
      const gone: Tour = { ...tour, dishIn: null, dishMenu: 'closed' }
      return aboutDish ? forward(gone) : gone
    }
    case 'dishMenu':
      return event.dishId === tour.dishId ? { ...tour, dishMenu: event.menu } : tour
    case 'keep':
      return id === 'deleteDish' ? forward({ ...tour, kept: true }) : tour
    case 'columnsChanged':
      return { ...tour, situation: { ...tour.situation, columns: event.columns } }
    case 'installOffered':
      return { ...tour, situation: { ...tour.situation, install: { ...tour.situation.install, offered: true } } }
    case 'installAnswered':
      return id === 'last' ? { ...tour, status: 'finished' } : tour
  }
}

// The steps that wait for the user to do something: no Weiter.
function waiting(tour: Tour): boolean {
  const id = tour.steps[tour.at]
  return id === 'addButton' || id === 'addDishLink' || id === 'deleteDish' || (id === 'columns' && !!moveTo(tour))
}

// Zurück, from every step but the first: not from inside Add Dish or the ⋯
// menu (closing it does that), nor from the new card, which can't be added
// again.
function canGoBack(tour: Tour): boolean {
  const id = tour.steps[tour.at]
  const inMenu = tour.dishMenu !== 'closed' && (id === 'deleteDish' || (id === 'columns' && !!moveTo(tour)))
  return tour.at > 0 && id !== 'addDishLink' && id !== 'newCard' && !inMenu
}

// Whether Weiter or Zurück can land on a step: never in Add Dish (a step to
// do, not to read again); on the new card only once a Dish was added; on
// deleting it only while it's on the Board and wasn't kept.
function reachable(tour: Tour, slot: TourSlot): boolean {
  if (slot === 'addDishLink') return false
  if (slot === 'newCard') return !!tour.dishId
  if (slot === 'deleteDish') return !!tour.dishIn && !tour.kept
  return true
}

// The next step that can show; past the last, the Tour is finished.
function forward(tour: Tour): Tour {
  const next = tour.steps.findIndex((slot, i) => i > tour.at && reachable(tour, slot))
  return next < 0 ? { ...tour, status: 'finished' } : { ...tour, at: next }
}

function backFrom(tour: Tour): number {
  let back = tour.at - 1
  while (back > 0 && !reachable(tour, tour.steps[back]!)) back--
  return back
}

// Step 5's Column: the first after the one the Tour's Dish landed in that
// isn't the Gekocht Column (moving there would record a Cooking), while the
// Dish is on the Board and not there yet; else null, and step 5 just
// explains the Columns. Always null without "move Dishes".
function moveTo({ situation: { columns, permissions }, landedIn, dishIn }: Tour): TourColumn | null {
  if (!permissions.moveDishes) return null
  const landed = columns.findIndex(c => c.id === landedIn)
  const column = landed < 0 ? null : columns.slice(landed + 1).find(c => !c.isGekocht)
  return column && dishIn && dishIn !== column.id ? column : null
}

// The step showing, in `t`'s words; null once the Tour has ended.
export function tourStep(tour: Tour, t: Strings['tour']): TourStep | null {
  if (tour.status !== 'running') return null
  const id = tour.steps[tour.at]
  if (!id) return null
  const target = STEPS.find(s => s.id === id)?.target ?? null
  const forward = tour.at === tour.steps.length - 1 ? 'finish' : 'next'
  const buttons: TourButton[] = canGoBack(tour) ? ['back', forward, 'skip'] : [forward, 'skip']
  if (id === 'last') return lastStep(tour.situation.install, buttons, t)
  const shown = { id, target, also: null, dishId: null, columnId: null, corner: null, handsOn: false, live: false }
  const pointing = { ...shown, pose: 'pointing', faces: 'target' } as const
  switch (id) {
    case 'hello':
      return { ...shown, pose: 'waving', faces: 'front', ...t.hello, buttons }
    case 'addButton':
      return { ...pointing, handsOn: true, ...t.addButton, buttons: ['back', 'withoutDish', 'skip'] }
    case 'addDishLink':
      return { ...pointing, handsOn: true, ...t.addDishLink, buttons: ['withoutDish', 'skip'] }
    case 'newCard':
      return { ...pointing, dishId: tour.dishId, ...t.newCard, buttons }
    case 'columns': {
      const column = moveTo(tour)
      return column
        ? moveStep(tour, column, pointing, buttons, t)
        : { ...pointing, title: t.columns.title, text: columnsText(tour.situation, t), buttons }
    }
    case 'deleteDish':
      return tour.dishMenu === 'closed'
        ? { ...pointing, dishId: tour.dishId, handsOn: true, ...t.deleteDish, buttons: ['back', 'keep', 'skip'] }
        // In the menu: its Löschen (not there while it shows the Columns).
        : { ...pointing, target: 'menu-delete', handsOn: true, title: t.deleteDish.title, text: t.deleteDish.menu, buttons: ['keep', 'skip'] }
    case 'boardSwitcher':
      return { ...pointing, ...t.boardSwitcher, buttons }
  }
}

// Step 5 to do: the card and the Column (its tab on phones, else its lane)
// while the card can be dragged there; the bubble follows into the ⋯ menu,
// onto "Verschieben nach…" and then the Column there.
function moveStep(tour: Tour, column: TourColumn, pointing: Omit<TourStep, 'title' | 'text' | 'buttons'>, buttons: TourButton[], t: Strings['tour']): TourStep {
  const doing = { ...pointing, id: 'moveDish', handsOn: true, title: t.moveDish.title(column.name) } as const
  switch (tour.dishMenu) {
    case 'closed':
      return { ...doing, target: 'dish', dishId: tour.dishId, also: 'column', columnId: column.id, live: true, text: t.moveDish.text(tour.situation.layout === 'phone'), buttons: buttons.filter(b => b !== 'next') }
    case 'actions':
      return { ...doing, target: 'menu-move', text: t.moveDish.menu, buttons: ['skip'] }
    case 'columns':
      return { ...doing, target: 'menu-column', columnId: column.id, text: t.moveDish.pick(column.name), buttons: ['skip'] }
  }
}

// Ideen → Diese Woche → Gekocht, by the Board's own names: the first Column
// that isn't the Gekocht Column, the next one after it that isn't either,
// and the Gekocht Column.
function columnsText({ columns, layout }: TourSituation, t: Strings['tour']): string {
  const stages = columns.filter(c => !c.isGekocht)
  const gekocht = columns.find(c => c.isGekocht)
  return t.columns.text(stages[0]?.name ?? '', stages[1]?.name ?? null, gekocht?.name ?? null, layout === 'phone')
}

// Step 8: the share tip once installed; else Installieren, when the browser
// offered it; else where that browser's menu has it, Topfbert pointing there.
function lastStep({ installed, offered, browser }: TourInstall, buttons: TourButton[], t: Strings['tour']): TourStep {
  const shown = { target: null, also: null, dishId: null, columnId: null, corner: null, handsOn: false, live: false, buttons }
  if (installed) return { ...shown, id: 'shareTip', pose: 'wink', faces: 'front', ...t.shareTip }
  // Installieren in place of Fertig: the dialog's answer ends the Tour.
  const install = buttons.map(b => b === 'finish' ? 'install' : b)
  if (offered) return { ...shown, id: 'install', pose: 'waving', faces: 'front', title: t.install.title, text: t.sharing, buttons: install }
  return { ...shown, id: 'installHow', corner: MENU_CORNER[browser], pose: 'pointing', faces: 'target', title: t.installHow.title, text: installHowText(browser, t) }
}

// Where each browser's menu sits; any other's is most likely top right.
const MENU_CORNER: Record<TourBrowser, TourCorner> = {
  chrome: 'top-right',
  samsung: 'bottom-right',
  edge: 'top-right',
  firefox: 'top-right',
  other: 'top-right',
}

// Firefox and any other browser: sharing from TikTok needs Chrome's install.
function installHowText(browser: TourBrowser, { installHow, sharing }: Strings['tour']): string {
  const shares = browser !== 'firefox' && browser !== 'other'
  return [installHow.menu[browser], sharing, shares ? null : installHow.chromeOnly].filter(Boolean).join(' ')
}

// The browser family a user agent names. Chrome's look-alikes (Samsung
// Internet, Edge, Opera and the like, webviews) name themselves after it.
export function tourBrowser(userAgent: string): TourBrowser {
  if (/SamsungBrowser\//.test(userAgent)) return 'samsung'
  if (/EdgA?\//.test(userAgent)) return 'edge'
  if (/Firefox\//.test(userAgent)) return 'firefox'
  if (/OPR\/|Opera|YaBrowser|UCBrowser|MiuiBrowser|Vivaldi|DuckDuckGo|Version\/[\d.]+ Chrome|; wv\)/.test(userAgent)) return 'other'
  return /Chrome\//.test(userAgent) ? 'chrome' : 'other'
}
