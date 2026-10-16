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

// What a step spotlights: the elements marked `data-tour="<name>"`. 'dish'
// is a Dish's card, the one with the step's `dishId`.
export type TourTarget = 'add-button' | 'add-dish-link' | 'dish' | 'columns' | 'board-switcher'
export type TourPose = 'waving' | 'pointing' | 'wink'
// Pointing, Topfbert faces what he points at; otherwise the user.
export type TourFacing = 'target' | 'front'
// 'withoutDish': "Ohne Gericht weiter", past the steps about adding a Dish.
// 'install': the browser's own install dialog.
export type TourButton = 'back' | 'next' | 'finish' | 'skip' | 'withoutDish' | 'install'
// The Tour's steps in its order. The last, on phones only, shows as one of
// three as it comes (tourStep): 'shareTip' (installed), 'install' (the
// browser offered installing) or 'installHow' (it didn't: where its menu
// has it).
export type TourSlot = 'hello' | 'addButton' | 'addDishLink' | 'newCard' | 'columns' | 'boardSwitcher' | 'last'
export type TourStepId = Exclude<TourSlot, 'last'> | 'shareTip' | 'install' | 'installHow'
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
  install: TourInstall
}

export type TourEvent
  = | { type: 'next' } | { type: 'back' } | { type: 'skip' } | { type: 'withoutDish' }
  // What happened on the Board: Add Dish opened or closed, a Dish added (by
  // its id, from the client Board module's result).
    | { type: 'addDishOpened' } | { type: 'addDishClosed' } | { type: 'dishAdded', dishId: string }
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
}

export interface TourStep {
  id: TourStepId
  target: TourTarget | null
  // The Dish whose card the target is.
  dishId: string | null
  // Without a target: the corner Topfbert points to (a browser's menu).
  corner: TourCorner | null
  // The user does something to the target and the step moves on once they
  // have: taps on the target reach it, and once it's gone (the user is busy
  // with what it opened) the bubble steps aside.
  handsOn: boolean
  pose: TourPose
  faces: TourFacing
  title: string
  text: string
  buttons: TourButton[]
}

// Every step, in the order they show: what it spotlights, and the target on
// the page it can't do without (the Dish steps all start at the add button).
const STEPS: { id: TourSlot, target: TourTarget | null, needs: TourTarget | null }[] = [
  { id: 'hello', target: null, needs: null },
  { id: 'addButton', target: 'add-button', needs: 'add-button' },
  { id: 'addDishLink', target: 'add-dish-link', needs: 'add-button' },
  { id: 'newCard', target: 'dish', needs: 'add-button' },
  { id: 'columns', target: 'columns', needs: 'columns' },
  { id: 'boardSwitcher', target: 'board-switcher', needs: 'board-switcher' },
  // Which of three it shows is picked as it comes: installing can be
  // offered meanwhile.
  { id: 'last', target: null, needs: null },
]
// The steps about adding a Dish, which "Ohne Gericht weiter" goes past.
const DISH_STEPS: TourSlot[] = ['addButton', 'addDishLink', 'newCard']
// The steps that wait for the user to do something: no Weiter.
const WAITING: TourSlot[] = ['addButton', 'addDishLink']

export function startTour(situation: TourSituation): Tour {
  const steps = STEPS
    .filter(s => !s.needs || situation.targets.includes(s.needs))
    .filter(s => s.id !== 'last' || situation.layout === 'phone')
    .map(s => s.id)
  return { status: 'running', situation, steps, at: 0, dishId: null }
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
      if (WAITING.includes(id)) return tour
      return tour.at + 1 < tour.steps.length ? { ...tour, at: tour.at + 1 } : { ...tour, status: 'finished' }
    case 'withoutDish': {
      if (!WAITING.includes(id)) return tour
      const past = tour.steps.findIndex(s => s !== 'hello' && !DISH_STEPS.includes(s))
      return past < 0 ? { ...tour, status: 'finished' } : { ...tour, at: past }
    }
    case 'addDishOpened':
      return id === 'addButton' ? to('addDishLink') : tour
    case 'addDishClosed':
      return id === 'addDishLink' ? to('addButton') : tour
    case 'dishAdded':
      return id === 'addDishLink' ? to('newCard', { dishId: event.dishId }) : tour
    case 'installOffered':
      return { ...tour, situation: { ...tour.situation, install: { ...tour.situation.install, offered: true } } }
    case 'installAnswered':
      return id === 'last' ? { ...tour, status: 'finished' } : tour
  }
}

// Zurück, from every step but the first: not from inside Add Dish (closing
// it does that), nor from the new card, which can't be added again.
function canGoBack(tour: Tour): boolean {
  const id = tour.steps[tour.at]
  return tour.at > 0 && id !== 'addDishLink' && id !== 'newCard'
}

// The step before, but never back into Add Dish (a step to do, not to read
// again), nor to a new card when no Dish was added.
function backFrom({ steps, at, dishId }: Tour): number {
  let back = at - 1
  while (back > 0 && (steps[back] === 'addDishLink' || (steps[back] === 'newCard' && !dishId))) back--
  return back
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
  const shown = { id, target, dishId: null, corner: null, handsOn: false }
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
    case 'columns':
      return { ...pointing, title: t.columns.title, text: columnsText(tour.situation, t), buttons }
    case 'boardSwitcher':
      return { ...pointing, ...t.boardSwitcher, buttons }
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
  const shown = { target: null, dishId: null, corner: null, handsOn: false, buttons }
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
