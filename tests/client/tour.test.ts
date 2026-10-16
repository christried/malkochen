import { expect, test } from 'vitest'
import { de } from '../../app/strings/de'
import { startTour, tourAfter, tourStep, type Tour, type TourColumn, type TourEvent, type TourSituation } from '../../app/tour/tour'

// Seam 4: the Tour module (CONTEXT.md → Tour, #298, #299), a step machine
// with no DOM. The situation the Tour starts in, the user's choices and what
// happened on the Board go in; the step it shows comes out: what it
// spotlights, Topfbert's pose, its words and its buttons, and whether the
// Tour still runs.

const IDEEN: TourColumn = { id: 'ideen', name: 'Ideen', isGekocht: false }
const WOCHE: TourColumn = { id: 'woche', name: 'Diese Woche', isGekocht: false }
const GEKOCHT: TourColumn = { id: 'gekocht', name: 'Gekocht', isGekocht: true }

function situation(change: Partial<TourSituation> = {}): TourSituation {
  return { layout: 'phone', columns: [IDEEN, WOCHE, GEKOCHT], targets: ['add-button', 'columns', 'board-switcher'], ...change }
}

type Happening = TourEvent['type'] | TourEvent
const after = (tour: Tour, ...events: Happening[]) =>
  events.reduce((t, event) => tourAfter(t, typeof event === 'string' ? { type: event } as TourEvent : event), tour)
const step = (tour: Tour) => tourStep(tour, de.tour)
const stepId = (tour: Tour) => step(tour)?.id ?? null

const added = (dishId: string): TourEvent => ({ type: 'dishAdded', dishId })
// The Tour as far as the Columns, past the Dish steps.
const atColumns = (change: Partial<TourSituation> = {}) => after(startTour(situation(change)), 'next', 'withoutDish')

test('the Tour greets first, waving, with nothing spotlit: Weiter or Überspringen', () => {
  const tour = startTour(situation())

  expect(tour.status).toBe('running')
  expect(step(tour)).toMatchObject({
    id: 'hello',
    target: null,
    pose: 'waving',
    faces: 'front',
    title: 'Hallo, ich bin Topfbert!',
    buttons: ['next', 'skip'],
  })
})

test('after the greeting, Topfbert points at the add button and waits for Add Dish to open: no Weiter', () => {
  const tour = after(startTour(situation()), 'next')

  expect(step(tour)).toMatchObject({
    id: 'addButton',
    target: 'add-button',
    pose: 'pointing',
    faces: 'target',
    title: 'Dein erstes Gericht',
    text: 'Tipp aufs Plus.',
    handsOn: true,
    buttons: ['back', 'withoutDish', 'skip'],
  })
  expect(stepId(after(tour, 'next'))).toBe('addButton')
})

test('Add Dish opened: the bubble follows onto its link field, and waits for the Dish to be saved', () => {
  const tour = after(startTour(situation()), 'next', 'addDishOpened')

  expect(step(tour)).toMatchObject({
    id: 'addDishLink',
    target: 'add-dish-link',
    pose: 'pointing',
    handsOn: true,
    buttons: ['withoutDish', 'skip'],
  })
  expect(step(tour)?.text).toMatch(/TikTok, Instagram/)
  expect(step(tour)?.text).toContain('„Ohne Link hinzufügen“')
  expect(stepId(after(tour, 'next'))).toBe('addDishLink')
  expect(stepId(after(tour, 'back'))).toBe('addDishLink')
})

test('the Dish saved: its new card is spotlit, "Da ist es!", and Weiter goes on to the Columns', () => {
  const tour = after(startTour(situation()), 'next', 'addDishOpened', added('dish-1'))

  expect(step(tour)).toMatchObject({
    id: 'newCard',
    target: 'dish',
    dishId: 'dish-1',
    pose: 'pointing',
    title: 'Da ist es!',
    handsOn: false,
    buttons: ['next', 'skip'],
  })
  expect(step(tour)?.text).toMatch(/Alle .* sehen .* sofort/)
  expect(tour.dishId).toBe('dish-1')
  // Add Dish closes right after saving: that doesn't take the Tour back.
  expect(stepId(after(tour, 'addDishClosed'))).toBe('newCard')
  expect(stepId(after(tour, 'next'))).toBe('columns')
})

test('Add Dish closed without saving goes back to the add button, to try again', () => {
  const tour = after(startTour(situation()), 'next', 'addDishOpened', 'addDishClosed')

  expect(stepId(tour)).toBe('addButton')
  expect(stepId(after(tour, 'addDishOpened', added('dish-2')))).toBe('newCard')
})

test.each([
  ['the add button', ['next']],
  ['the link field', ['next', 'addDishOpened']],
] as const)('"Ohne Gericht weiter" on %s skips past the Dish steps to the Columns', (_, before) => {
  const tour = after(startTour(situation()), ...before, 'withoutDish')

  expect(step(tour)).toMatchObject({ id: 'columns', target: 'columns' })
  expect(tour.dishId).toBeNull()
  // A Dish saved after all doesn't bring the Dish steps back.
  expect(stepId(after(tour, added('late')))).toBe('columns')
})

test('only the steps waiting for the user offer "Ohne Gericht weiter"', () => {
  const tour = after(startTour(situation()), 'next', 'addDishOpened', added('dish-3'))

  expect(after(tour, 'withoutDish')).toEqual(tour)
  expect(after(startTour(situation()), 'withoutDish')).toEqual(startTour(situation()))
})

test('happenings on the Board that a step isn\'t waiting for change nothing', () => {
  const hello = startTour(situation())
  const columns = atColumns()

  expect(after(hello, 'addDishOpened', added('x'), 'addDishClosed')).toEqual(hello)
  expect(after(columns, 'addDishOpened', added('x'), 'addDishClosed')).toEqual(columns)
})

test('Zurück from the Columns goes to the new card when a Dish was added, else to the add button', () => {
  const withDish = after(startTour(situation()), 'next', 'addDishOpened', added('dish-4'), 'next')

  expect(stepId(after(withDish, 'back'))).toBe('newCard')
  expect(stepId(after(atColumns(), 'back'))).toBe('addButton')
  expect(stepId(after(atColumns(), 'back', 'back'))).toBe('hello')
})

test('Weiter goes from the Columns to the Board Switcher, which finishes it', () => {
  const tour = atColumns()

  expect(stepId(after(tour, 'next'))).toBe('boardSwitcher')
  const finished = after(tour, 'next', 'next')
  expect(finished.status).toBe('finished')
  expect(step(finished)).toBeNull()
})

test('the Columns step points at the Columns, and the Board Switcher step at the switcher', () => {
  const columns = step(atColumns())
  const switcher = step(after(atColumns(), 'next'))

  expect(columns).toMatchObject({ target: 'columns', pose: 'pointing', faces: 'target', handsOn: false, buttons: ['back', 'next', 'skip'] })
  expect(switcher).toMatchObject({ target: 'board-switcher', pose: 'pointing', faces: 'target', buttons: ['back', 'finish', 'skip'] })
  expect(switcher?.text).toMatch(/lädst du andere .* ein/)
  expect(switcher?.text).toMatch(/wechselst/)
  expect(switcher?.text).toMatch(/neues/)
})

test('Zurück goes back a step; the greeting has none', () => {
  const tour = after(atColumns(), 'next')

  expect(stepId(after(tour, 'back'))).toBe('columns')
  // Nothing before the greeting: it stays.
  expect(stepId(after(startTour(situation()), 'back'))).toBe('hello')
})

test.each([
  ['the greeting', []],
  ['the add button', ['next']],
  ['the link field', ['next', 'addDishOpened']],
  ['the new card', ['next', 'addDishOpened', added('d')]],
  ['the Columns', ['next', 'withoutDish']],
  ['the Board Switcher', ['next', 'withoutDish', 'next']],
] as [string, Happening[]][])('Überspringen on %s ends the Tour as skipped', (_, before) => {
  const tour = after(startTour(situation()), ...before)

  const skipped = after(tour, 'skip')

  expect(skipped.status).toBe('skipped')
  expect(step(skipped)).toBeNull()
})

test('an ended Tour ignores what comes after', () => {
  const finished = after(atColumns(), 'next', 'next')
  const skipped = after(startTour(situation()), 'skip')

  expect(after(finished, 'back', 'skip').status).toBe('finished')
  expect(after(skipped, 'next', 'back', 'addDishOpened').status).toBe('skipped')
})

test('the Columns step explains the stages with the Board\'s own Column names', () => {
  const columns = [
    { id: 'a', name: 'Vielleicht', isGekocht: false },
    { id: 'b', name: 'Bald', isGekocht: false },
    { id: 'c', name: 'Geschafft', isGekocht: true },
  ]

  const text = step(atColumns({ columns }))?.text

  expect(text).toContain('„Vielleicht“')
  expect(text).toContain('„Bald“')
  expect(text).toContain('„Geschafft“')
  expect(text).not.toContain('Ideen')
})

test('reordered Columns: the first one that isn\'t Gekocht comes first, then the next one that isn\'t', () => {
  const text = step(atColumns({ columns: [WOCHE, GEKOCHT, IDEEN] }))?.text ?? ''

  expect(text.indexOf('„Diese Woche“')).toBeLessThan(text.indexOf('„Ideen“'))
  expect(text.indexOf('„Ideen“')).toBeLessThan(text.indexOf('„Gekocht“'))
})

test('with only one Column besides Gekocht, the Columns step names just those two', () => {
  const text = step(atColumns({ columns: [IDEEN, GEKOCHT] }))?.text

  expect(text).toContain('„Ideen“')
  expect(text).toContain('„Gekocht“')
  expect(text).not.toContain('Diese Woche')
})

test('on phones the Columns step says how to switch between them; side by side it doesn\'t need to', () => {
  const phone = step(atColumns({ layout: 'phone' }))?.text
  const larger = step(atColumns({ layout: 'larger' }))?.text

  expect(phone).toMatch(/wisch/i)
  expect(larger).not.toMatch(/wisch/i)
})

test('a step whose target isn\'t on the page is left out', () => {
  const tour = startTour(situation({ targets: ['board-switcher'] }))

  expect(stepId(after(tour, 'next'))).toBe('boardSwitcher')
  expect(stepId(after(tour, 'next', 'back'))).toBe('hello')
})

test('without the add button on the page, the Dish steps are all left out', () => {
  const tour = startTour(situation({ targets: ['columns', 'board-switcher'] }))

  expect(stepId(after(tour, 'next'))).toBe('columns')
})

test('"Ohne Gericht weiter" with nothing after the Dish steps finishes the Tour', () => {
  const tour = after(startTour(situation({ targets: ['add-button'] })), 'next', 'withoutDish')

  expect(tour.status).toBe('finished')
})

test('with no targets on the page, the greeting is all there is, and Weiter finishes it', () => {
  const tour = startTour(situation({ targets: [] }))

  expect(step(tour)?.buttons).toEqual(['finish', 'skip'])
  expect(after(tour, 'next').status).toBe('finished')
})
