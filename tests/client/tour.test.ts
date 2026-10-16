import { expect, test } from 'vitest'
import { de } from '../../app/strings/de'
import { startTour, tourAfter, tourStep, type Tour, type TourColumn, type TourEvent, type TourSituation } from '../../app/tour/tour'

// Seam 4: the Tour module (CONTEXT.md → Tour, #298), a step machine with no
// DOM. The situation the Tour starts in and the user's choices go in; the
// step it shows comes out: what it spotlights, Topfbert's pose, its words
// and its buttons, and whether the Tour still runs.

const IDEEN: TourColumn = { id: 'ideen', name: 'Ideen', isGekocht: false }
const WOCHE: TourColumn = { id: 'woche', name: 'Diese Woche', isGekocht: false }
const GEKOCHT: TourColumn = { id: 'gekocht', name: 'Gekocht', isGekocht: true }

function situation(change: Partial<TourSituation> = {}): TourSituation {
  return { layout: 'phone', columns: [IDEEN, WOCHE, GEKOCHT], targets: ['columns', 'board-switcher'], ...change }
}

const after = (tour: Tour, ...events: TourEvent['type'][]) => events.reduce((t, type) => tourAfter(t, { type }), tour)
const step = (tour: Tour) => tourStep(tour, de.tour)
const stepId = (tour: Tour) => step(tour)?.id ?? null

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

test('Weiter goes from the greeting to the Columns, then to the Board Switcher, which finishes it', () => {
  const tour = startTour(situation())

  expect(stepId(after(tour, 'next'))).toBe('columns')
  expect(stepId(after(tour, 'next', 'next'))).toBe('boardSwitcher')
  const finished = after(tour, 'next', 'next', 'next')
  expect(finished.status).toBe('finished')
  expect(step(finished)).toBeNull()
})

test('the Columns step points at the Columns, and the Board Switcher step at the switcher', () => {
  const columns = step(after(startTour(situation()), 'next'))
  const switcher = step(after(startTour(situation()), 'next', 'next'))

  expect(columns).toMatchObject({ target: 'columns', pose: 'pointing', faces: 'target', buttons: ['back', 'next', 'skip'] })
  expect(switcher).toMatchObject({ target: 'board-switcher', pose: 'pointing', faces: 'target', buttons: ['back', 'finish', 'skip'] })
  expect(switcher?.text).toMatch(/lädst du andere .* ein/)
  expect(switcher?.text).toMatch(/wechselst/)
  expect(switcher?.text).toMatch(/neues/)
})

test('Zurück goes back a step; the greeting has none', () => {
  const tour = after(startTour(situation()), 'next', 'next')

  expect(stepId(after(tour, 'back'))).toBe('columns')
  expect(stepId(after(tour, 'back', 'back'))).toBe('hello')
  // Nothing before the greeting: it stays.
  expect(stepId(after(tour, 'back', 'back', 'back'))).toBe('hello')
})

test.each([0, 1, 2])('Überspringen on step %i ends the Tour as skipped', (at) => {
  const tour = after(startTour(situation()), ...Array<'next'>(at).fill('next'))

  const skipped = after(tour, 'skip')

  expect(skipped.status).toBe('skipped')
  expect(step(skipped)).toBeNull()
})

test('an ended Tour ignores what comes after', () => {
  const finished = after(startTour(situation()), 'next', 'next', 'next')
  const skipped = after(startTour(situation()), 'skip')

  expect(after(finished, 'back', 'skip').status).toBe('finished')
  expect(after(skipped, 'next', 'back').status).toBe('skipped')
})

test('the Columns step explains the stages with the Board\'s own Column names', () => {
  const columns = [
    { id: 'a', name: 'Vielleicht', isGekocht: false },
    { id: 'b', name: 'Bald', isGekocht: false },
    { id: 'c', name: 'Geschafft', isGekocht: true },
  ]

  const text = step(after(startTour(situation({ columns })), 'next'))?.text

  expect(text).toContain('„Vielleicht“')
  expect(text).toContain('„Bald“')
  expect(text).toContain('„Geschafft“')
  expect(text).not.toContain('Ideen')
})

test('reordered Columns: the first one that isn\'t Gekocht comes first, then the next one that isn\'t', () => {
  const text = step(after(startTour(situation({ columns: [WOCHE, GEKOCHT, IDEEN] })), 'next'))?.text ?? ''

  expect(text.indexOf('„Diese Woche“')).toBeLessThan(text.indexOf('„Ideen“'))
  expect(text.indexOf('„Ideen“')).toBeLessThan(text.indexOf('„Gekocht“'))
})

test('with only one Column besides Gekocht, the Columns step names just those two', () => {
  const text = step(after(startTour(situation({ columns: [IDEEN, GEKOCHT] })), 'next'))?.text

  expect(text).toContain('„Ideen“')
  expect(text).toContain('„Gekocht“')
  expect(text).not.toContain('Diese Woche')
})

test('on phones the Columns step says how to switch between them; side by side it doesn\'t need to', () => {
  const phone = step(after(startTour(situation({ layout: 'phone' })), 'next'))?.text
  const larger = step(after(startTour(situation({ layout: 'larger' })), 'next'))?.text

  expect(phone).toMatch(/wisch/i)
  expect(larger).not.toMatch(/wisch/i)
})

test('a step whose target isn\'t on the page is left out', () => {
  const tour = startTour(situation({ targets: ['board-switcher'] }))

  expect(stepId(after(tour, 'next'))).toBe('boardSwitcher')
  expect(stepId(after(tour, 'next', 'back'))).toBe('hello')
})

test('with no targets on the page, the greeting is all there is, and Weiter finishes it', () => {
  const tour = startTour(situation({ targets: [] }))

  expect(step(tour)?.buttons).toEqual(['finish', 'skip'])
  expect(after(tour, 'next').status).toBe('finished')
})
