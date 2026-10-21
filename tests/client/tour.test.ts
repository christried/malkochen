import { expect, test } from 'vitest'
import { de } from '../../app/strings/de'
import { ALL_PERMISSIONS } from '../../shared/permissions'
import { startTour, tourAfter, tourBrowser, tourStep, type Tour, type TourColumn, type TourEvent, type TourInstall, type TourSituation } from '../../app/tour/tour'

// Seam 4: the Tour module (CONTEXT.md → Tour, #298, #299), a step machine
// with no DOM. The situation the Tour starts in, the user's choices and what
// happened on the Board go in; the step it shows comes out: what it
// spotlights, Topfbert's pose, its words and its buttons, and whether the
// Tour still runs.

const IDEEN: TourColumn = { id: 'ideen', name: 'Ideen', isGekocht: false }
const WOCHE: TourColumn = { id: 'woche', name: 'Diese Woche', isGekocht: false }
const GEKOCHT: TourColumn = { id: 'gekocht', name: 'Gekocht', isGekocht: true }
// In Chrome's tab, which hasn't offered installing.
const NOT_OFFERED: TourInstall = { installed: false, offered: false, browser: 'chrome' }

function situation(change: Partial<TourSituation> = {}): TourSituation {
  return { layout: 'phone', columns: [IDEEN, WOCHE, GEKOCHT], targets: ['add-button', 'columns', 'board-switcher'], permissions: ALL_PERMISSIONS, install: NOT_OFFERED, ...change }
}

type Happening = TourEvent['type'] | TourEvent
const after = (tour: Tour, ...events: Happening[]) =>
  events.reduce((t, event) => tourAfter(t, typeof event === 'string' ? { type: event } as TourEvent : event), tour)
const step = (tour: Tour) => tourStep(tour, de.tour)
const stepId = (tour: Tour) => step(tour)?.id ?? null

// Added: by default it lands in the first Column, Ideen.
const added = (dishId: string, columnId = IDEEN.id): TourEvent => ({ type: 'dishAdded', dishId, columnId })
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
  expect(stepId(after(tour, 'next'))).toBe('moveDish')
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

test('Zurück from the move step goes to the new card; from the Columns, without a Dish, to the add button', () => {
  const withDish = after(startTour(situation()), 'next', 'addDishOpened', added('dish-4'), 'next')

  expect(stepId(after(withDish, 'back'))).toBe('newCard')
  expect(stepId(after(atColumns(), 'back'))).toBe('addButton')
  expect(stepId(after(atColumns(), 'back', 'back'))).toBe('hello')
})

test('Weiter goes from the Columns to the Board Switcher, which finishes it side by side', () => {
  const tour = atColumns({ layout: 'larger' })

  expect(stepId(after(tour, 'next'))).toBe('boardSwitcher')
  const finished = after(tour, 'next', 'next')
  expect(finished.status).toBe('finished')
  expect(step(finished)).toBeNull()
})

test('the Columns step points at the Columns, and the Board Switcher step at the switcher', () => {
  const columns = step(atColumns())
  const switcher = step(after(atColumns({ layout: 'larger' }), 'next'))

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
  const finished = after(atColumns(), 'next', 'next', 'next')
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
  const tour = after(startTour(situation({ layout: 'larger', targets: ['add-button'] })), 'next', 'withoutDish')

  expect(tour.status).toBe('finished')
})

test('side by side with no targets on the page, the greeting is all there is, and Weiter finishes it', () => {
  const tour = startTour(situation({ layout: 'larger', targets: [] }))

  expect(step(tour)?.buttons).toEqual(['finish', 'skip'])
  expect(after(tour, 'next').status).toBe('finished')
})

// Steps 5 and 6: moving the Tour's Dish to the next Column, and deleting it.
const atMove = (change: Partial<TourSituation> = {}, landed = IDEEN.id) =>
  after(startTour(situation(change)), 'next', 'addDishOpened', added('dish', landed), 'addDishClosed', 'next')

test('with a Dish added, step 5 asks to move it to the next Column by its name: card and Column spotlit, no Weiter', () => {
  const tour = atMove()

  expect(step(tour)).toMatchObject({
    id: 'moveDish',
    target: 'dish',
    dishId: 'dish',
    also: 'column',
    columnId: 'woche',
    handsOn: true,
    live: true,
    pose: 'pointing',
    faces: 'target',
    title: 'Zieh es auf „Diese Woche“',
    buttons: ['back', 'skip'],
  })
  expect(stepId(after(tour, 'next'))).toBe('moveDish')
})

const BALD: TourColumn = { id: 'bald', name: 'Bald', isGekocht: false }
const moveTitle = (tour: Tour) => step(tour)?.id === 'moveDish' ? step(tour)?.title : null

test.each([
  ['renamed', [IDEEN, { ...WOCHE, name: 'Nächste Woche' }, GEKOCHT], 'Zieh es auf „Nächste Woche“'],
  ['reordered, Gekocht in between', [IDEEN, GEKOCHT, WOCHE], 'Zieh es auf „Diese Woche“'],
  ['the next one deleted', [IDEEN, BALD, GEKOCHT], 'Zieh es auf „Bald“'],
  ['landed in a later Column', [BALD, IDEEN, WOCHE, GEKOCHT], 'Zieh es auf „Diese Woche“'],
] as const)('step 5 names the first Column after where the Dish landed that isn\'t Gekocht: %s', (_, columns, title) => {
  expect(moveTitle(atMove({ columns: [...columns] }))).toBe(title)
})

test.each([
  ['only one Column besides Gekocht', [IDEEN, GEKOCHT]],
  ['only Gekocht after it', [WOCHE, IDEEN, GEKOCHT]],
] as const)('with no such Column (%s), step 5 just explains the Columns: never into Gekocht', (_, columns) => {
  const tour = atMove({ columns: [...columns] })

  expect(step(tour)).toMatchObject({ id: 'columns', target: 'columns', handsOn: false, buttons: ['back', 'next', 'skip'] })
})

test('a Column renamed or deleted during the Tour: step 5 follows the Board', () => {
  const tour = atMove({ columns: [IDEEN, WOCHE, BALD, GEKOCHT] })

  const renamed = after(tour, { type: 'columnsChanged', columns: [IDEEN, { ...WOCHE, name: 'Demnächst' }, BALD, GEKOCHT] })
  const deleted = after(tour, { type: 'columnsChanged', columns: [IDEEN, BALD, GEKOCHT] })

  expect(moveTitle(renamed)).toBe('Zieh es auf „Demnächst“')
  expect(moveTitle(deleted)).toBe('Zieh es auf „Bald“')
})

const moved = (columnId: string): TourEvent => ({ type: 'dishMoved', dishId: 'dish', columnId })
const menu = (open: 'closed' | 'actions' | 'columns'): TourEvent => ({ type: 'dishMenu', dishId: 'dish', menu: open })

test('dragged into that Column, the Dish is there and step 6 shows', () => {
  expect(stepId(after(atMove(), moved('woche')))).toBe('deleteDish')
})

test('through the ⋯ menu: the bubble follows onto "Verschieben nach…", then that Column, and the move counts the same', () => {
  const inMenu = after(atMove(), menu('actions'))
  const choosing = after(inMenu, menu('columns'))

  expect(step(inMenu)).toMatchObject({ id: 'moveDish', target: 'menu-move', also: null, live: false, handsOn: true, text: 'Tipp auf „Verschieben nach…“.', buttons: ['skip'] })
  expect(step(choosing)).toMatchObject({ id: 'moveDish', target: 'menu-column', columnId: 'woche', text: 'Und jetzt auf „Diese Woche“.', buttons: ['skip'] })
  // The menu closed without moving: back to the card.
  expect(step(after(choosing, menu('closed')))).toMatchObject({ target: 'dish', also: 'column' })
  expect(stepId(after(choosing, menu('closed'), moved('woche')))).toBe('deleteDish')
})

test('moved to a different Column doesn\'t count; neither does another Dish moved there', () => {
  const tour = atMove({ columns: [IDEEN, WOCHE, BALD, GEKOCHT] })

  expect(moveTitle(after(tour, moved('bald')))).toBe('Zieh es auf „Diese Woche“')
  expect(moveTitle(after(tour, { type: 'dishMoved', dishId: 'other', columnId: 'woche' }))).toBe('Zieh es auf „Diese Woche“')
  expect(stepId(after(tour, moved('bald'), moved('woche')))).toBe('deleteDish')
})

const atDelete = () => after(atMove(), moved('woche'))

test('step 6 spotlights the card\'s ⋯, "Und wieder weg", mentioning Rückgängig: Behalten instead of Weiter', () => {
  const tour = atDelete()

  expect(step(tour)).toMatchObject({
    id: 'deleteDish',
    target: 'dish-menu',
    dishId: 'dish',
    handsOn: true,
    live: false,
    pose: 'pointing',
    title: 'Und wieder weg',
    buttons: ['back', 'keep', 'skip'],
  })
  expect(step(tour)?.text).toContain('„Rückgängig“')
  expect(stepId(after(tour, 'next'))).toBe('deleteDish')
})

test('in the ⋯ menu, the bubble follows onto Archivieren; archived, the Tour goes on to the Board Switcher', () => {
  const inMenu = after(atDelete(), menu('actions'))

  expect(step(inMenu)).toMatchObject({ id: 'deleteDish', target: 'menu-delete', buttons: ['keep', 'skip'] })
  expect(stepId(after(inMenu, menu('closed'), { type: 'dishGone', dishId: 'dish' }))).toBe('boardSwitcher')
})

test('"Behalten" keeps the Dish and moves on; going back doesn\'t ask to delete it again', () => {
  const kept = after(atDelete(), 'keep')

  expect(stepId(kept)).toBe('boardSwitcher')
  expect(step(after(kept, 'back'))).toMatchObject({ id: 'columns', handsOn: false })
  expect(stepId(after(kept, 'back', 'next'))).toBe('boardSwitcher')
})

test('a delete undone: the Dish comes back and the Tour carries on', () => {
  const deleted = after(atDelete(), { type: 'dishGone', dishId: 'dish' })
  const undone = after(deleted, moved('woche'))

  expect(stepId(undone)).toBe('boardSwitcher')
  expect(undone.status).toBe('running')
  expect(stepId(after(deleted, 'back'))).toBe('columns')
})

test('the Dish gone during step 5 (deleted, or to another Board): the Tour goes past deleting it', () => {
  const tour = after(atMove(), { type: 'dishGone', dishId: 'dish' })

  expect(stepId(tour)).toBe('boardSwitcher')
  expect(step(after(tour, 'back'))).toMatchObject({ id: 'columns', handsOn: false })
})

test('Zurück from step 6 explains the Columns, where the Dish already is; not from inside the ⋯ menu', () => {
  expect(step(after(atDelete(), 'back'))).toMatchObject({ id: 'columns', handsOn: false })
  expect(stepId(after(atDelete(), menu('actions'), 'back'))).toBe('deleteDish')
  expect(stepId(after(atMove(), menu('actions'), 'back'))).toBe('moveDish')
})

test.each([
  ['step 5', atMove],
  ['step 5 in the menu', () => after(atMove(), menu('columns'))],
  ['step 6', atDelete],
] as const)('Überspringen on %s ends the Tour as skipped', (_, at) => {
  expect(after(at(), 'skip').status).toBe('skipped')
})

// Permissions (#343): the Tour never asks for what the Member may not do.
test('without "add Dishes", the Dish steps are all left out, even with an add button on the page', () => {
  const tour = startTour(situation({ permissions: { ...ALL_PERMISSIONS, addDishes: false } }))

  expect(tour.steps).toEqual(['hello', 'columns', 'boardSwitcher', 'last'])
})

test('without "move Dishes", step 5 just explains the Columns, and Weiter goes on to deleting the Dish', () => {
  const tour = atMove({ permissions: { ...ALL_PERMISSIONS, moveDishes: false } })

  expect(step(tour)).toMatchObject({ id: 'columns', handsOn: false, buttons: ['back', 'next', 'skip'] })
  expect(stepId(after(tour, 'next'))).toBe('deleteDish')
})

test('without "archive Dishes", deleting the Tour\'s Dish still shows: a Member may always archive their own', () => {
  const tour = atMove({ permissions: { ...ALL_PERMISSIONS, archiveDishes: false } })

  expect(stepId(after(tour, { type: 'dishMoved', dishId: 'dish', columnId: 'woche' }))).toBe('deleteDish')
})

// Step 8, phones only: the share tip once installed, else how to install.
const atLast = (change: Partial<TourSituation> = {}) => after(atColumns(change), 'next', 'next')

test('installed on a phone, the last step is the share tip, Topfbert winking: Teilen → malkochen', () => {
  const tour = atLast({ install: { installed: true, offered: false, browser: 'chrome' } })

  expect(step(tour)).toMatchObject({ id: 'shareTip', target: null, corner: null, pose: 'wink', faces: 'front', buttons: ['back', 'finish', 'skip'] })
  expect(step(tour)?.text).toMatch(/TikTok/)
  expect(step(tour)?.text).toContain('Teilen → malkochen')
  expect(step(after(atColumns(), 'next'))?.buttons).toEqual(['back', 'next', 'skip'])
  expect(after(tour, 'next').status).toBe('finished')
})

test('in a browser that offered installing, the last step has "Installieren"; answering its dialog finishes the Tour', () => {
  const tour = atLast({ install: { installed: false, offered: true, browser: 'chrome' } })

  expect(step(tour)).toMatchObject({ id: 'install', target: null, corner: null, buttons: ['back', 'install', 'skip'] })
  expect(step(tour)?.text).toMatch(/Installiert .* TikTok/)
  // Answered: installed or not, the Tour ends as usual.
  expect(after(tour, 'installAnswered').status).toBe('finished')
  // Anywhere else, an answer changes nothing.
  expect(after(atColumns(), 'installAnswered')).toEqual(atColumns())
})

test('installing offered during the Tour: the last step uses it', () => {
  const tour = after(atColumns(), 'installOffered', 'next', 'next')

  expect(step(tour)?.id).toBe('install')
  expect(step(after(atColumns(), 'next', 'next'))?.id).toBe('installHow')
})

test.each([
  ['chrome', 'top-right', /oben rechts auf ⋮ .*„Zum Startbildschirm hinzufügen“/],
  ['samsung', 'bottom-right', /unten rechts auf ≡.*„Seite hinzufügen zu“.*„Startbildschirm“/],
  ['edge', 'top-right', /oben rechts auf … .*„Zum Telefon hinzufügen“/],
  ['firefox', 'top-right', /oben rechts auf ⋮ .*„Zum Startbildschirm hinzufügen“/],
  ['other', 'top-right', /Menü deines Browsers .*„Zum Startbildschirm hinzufügen“/],
] as const)('in %s without the offer, the last step says where its menu has installing, Topfbert pointing there', (browser, corner, where) => {
  const tour = atLast({ install: { installed: false, offered: false, browser } })

  expect(step(tour)).toMatchObject({ id: 'installHow', target: null, corner, pose: 'pointing', faces: 'target', buttons: ['back', 'finish', 'skip'] })
  expect(step(tour)?.text).toMatch(where)
})

test.each([
  ['chrome', false],
  ['samsung', false],
  ['edge', false],
  ['firefox', true],
  ['other', true],
] as const)('in %s, sharing from TikTok only working when installed from Chrome is said: %s', (browser, said) => {
  const text = step(atLast({ install: { installed: false, offered: false, browser } }))?.text ?? ''

  expect(text).toMatch(/TikTok/)
  expect(/nur, wenn du malkochen aus Chrome installierst/.test(text)).toBe(said)
})

test('side by side, there is no last step: no share tip and nothing to install', () => {
  for (const install of [
    { installed: true, offered: false, browser: 'chrome' },
    { installed: false, offered: true, browser: 'chrome' },
    { installed: false, offered: false, browser: 'firefox' },
  ] as const) {
    const tour = atColumns({ layout: 'larger', install })

    expect(stepId(after(tour, 'next'))).toBe('boardSwitcher')
    expect(after(tour, 'next', 'next').status).toBe('finished')
  }
})

test.each([
  ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36', 'chrome'],
  ['Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36', 'samsung'],
  ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 EdgA/129.0.0.0', 'edge'],
  ['Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0', 'firefox'],
  ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 OPR/84.0.0', 'other'],
  ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 DuckDuckGo/5', 'other'],
] as const)('the browser family is read from the user agent: %s', (userAgent, browser) => {
  expect(tourBrowser(userAgent)).toBe(browser)
})
