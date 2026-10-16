import type { Strings } from '../strings/de'

// The Tour (CONTEXT.md, #296): Topfbert's short walk through a Board. This is
// its brain, a step machine that knows nothing of the page: the situation it
// starts in and the user's choices go in, the step to show comes out (what
// it spotlights, by its `data-tour` name; Topfbert's pose and where he
// faces; its words and buttons), and whether it still runs. The Board's
// BoardTour feeds it and TourLayer draws what it answers.

// The Tour's version. A user who finished or skipped a lower one (or none)
// gets this one once; raising it shows the next Tour to everyone again.
export const TOUR_VERSION = 1

// What a step spotlights: the elements marked `data-tour="<name>"`.
export type TourTarget = 'columns' | 'board-switcher'
export type TourPose = 'waving' | 'pointing' | 'wink'
// Pointing, Topfbert faces what he points at; otherwise the user.
export type TourFacing = 'target' | 'front'
export type TourButton = 'back' | 'next' | 'finish' | 'skip'
export type TourStepId = 'hello' | 'columns' | 'boardSwitcher'

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
}

export type TourEvent = { type: 'next' } | { type: 'back' } | { type: 'skip' }

export interface Tour {
  status: 'running' | 'finished' | 'skipped'
  situation: TourSituation
  // The steps this Tour shows, in order, and the one showing.
  steps: TourStepId[]
  at: number
}

export interface TourStep {
  id: TourStepId
  target: TourTarget | null
  pose: TourPose
  faces: TourFacing
  title: string
  text: string
  buttons: TourButton[]
}

// Every step, in the order they show; `target`: the one it can't do without.
const STEPS: { id: TourStepId, target: TourTarget | null }[] = [
  { id: 'hello', target: null },
  { id: 'columns', target: 'columns' },
  { id: 'boardSwitcher', target: 'board-switcher' },
]

export function startTour(situation: TourSituation): Tour {
  const steps = STEPS.filter(s => !s.target || situation.targets.includes(s.target)).map(s => s.id)
  return { status: 'running', situation, steps, at: 0 }
}

// The Tour after `event`. An ended Tour stays as it ended.
export function tourAfter(tour: Tour, event: TourEvent): Tour {
  if (tour.status !== 'running') return tour
  switch (event.type) {
    case 'skip':
      return { ...tour, status: 'skipped' }
    case 'back':
      return { ...tour, at: Math.max(0, tour.at - 1) }
    case 'next':
      return tour.at + 1 < tour.steps.length ? { ...tour, at: tour.at + 1 } : { ...tour, status: 'finished' }
  }
}

// The step showing, in `t`'s words; null once the Tour has ended.
export function tourStep(tour: Tour, t: Strings['tour']): TourStep | null {
  if (tour.status !== 'running') return null
  const id = tour.steps[tour.at]
  if (!id) return null
  const target = STEPS.find(s => s.id === id)?.target ?? null
  const last = tour.at === tour.steps.length - 1
  const buttons: TourButton[] = [...tour.at > 0 ? ['back' as const] : [], last ? 'finish' : 'next', 'skip']
  const pointing = { pose: 'pointing', faces: 'target' } as const
  switch (id) {
    case 'hello':
      return { id, target, pose: 'waving', faces: 'front', ...t.hello, buttons }
    case 'columns':
      return { id, target, ...pointing, title: t.columns.title, text: columnsText(tour.situation, t), buttons }
    case 'boardSwitcher':
      return { id, target, ...pointing, ...t.boardSwitcher, buttons }
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
