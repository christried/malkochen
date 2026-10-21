import type { Browser, Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { inviteToken } from './invite'
import { fastPolls } from './polls'

// Members and Owner rules (PRD stories 62, 67–71) in Board settings. Evelyn
// owns the Boards; Radia joins them. Both are used by this file only.

const EVELYN = ALLOWLISTED[14]
const RADIA = ALLOWLISTED[11]

// A new Board of Evelyn's that Radia has joined through its Invite Link, and
// Radia's browser, signed in.
async function sharedBoard(page: Page, browser: Browser, name: string): Promise<{ boardId: string, radia: Page }> {
  await signIn(page, EVELYN)
  const res = await page.request.post('/api/boards', { data: { name, emoji: '🥗' } })
  expect(res.status()).toBe(201)
  const { id: boardId } = await res.json() as { id: string }
  const token = await inviteToken(page, boardId)

  const radia = await newTab(browser)
  await signIn(radia, RADIA)
  expect((await radia.request.post(`/api/invites/${token}/join`)).status()).toBe(200)
  return { boardId, radia }
}

const memberRows = (page: Page) => page.getByRole('list', { name: 'Mitglieder' }).getByRole('listitem')

test('the Owner sees the Members, hands ownership over, and can then leave', async ({ page, browser }) => {
  const { boardId } = await sharedBoard(page, browser, 'Salatbar')
  await gotoHydrated(page, `/b/${boardId}/settings`)

  await expect(memberRows(page)).toHaveText([/evelyn \(du\).*Besitzer:in/, /radia/])
  await expect(page.getByText('Um das Board zu verlassen, übertrag erst den Besitz an ein anderes Mitglied.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Board verlassen' })).toHaveCount(0)

  await page.getByRole('button', { name: 'radia verwalten' }).click()
  await page.getByRole('dialog', { name: 'radia' }).getByRole('button', { name: 'Besitz übertragen' }).click()
  await page.getByRole('dialog', { name: 'Besitz an radia übertragen?' }).getByRole('button', { name: 'Besitz übertragen' }).click()

  await expect(page.getByText('radia hat jetzt den Besitz.')).toBeVisible()
  await expect(memberRows(page)).toHaveText([/radia.*Besitzer:in/, /evelyn \(du\)/])
  await expect(page.getByRole('button', { name: 'radia verwalten' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Link zurücksetzen' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Board verlassen' }).click()
  await page.getByRole('dialog', { name: 'Board verlassen?' }).getByRole('button', { name: 'Board verlassen' }).click()
  await expect(page).not.toHaveURL(new RegExp(boardId))
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('🥗 Salatbar')
})

test('a Member leaves, and lands on another Board', async ({ page, browser }) => {
  const { boardId, radia } = await sharedBoard(page, browser, 'Mensa')
  await gotoHydrated(radia, `/b/${boardId}/settings`)
  await expect(radia.getByRole('button', { name: 'Board löschen' })).toHaveCount(0)
  await expect(radia.getByRole('button', { name: 'evelyn verwalten' })).toHaveCount(0)

  await radia.getByRole('button', { name: 'Board verlassen' }).click()
  const dialog = radia.getByRole('dialog', { name: 'Board verlassen?' })
  await expect(dialog).toContainText('Deine Gerichte bleiben auf dem Board')
  await dialog.getByRole('button', { name: 'Board verlassen' }).click()

  await expect(radia).not.toHaveURL(/settings/)
  await expect(radia).not.toHaveURL(new RegExp(boardId))
  await expect(radia.getByRole('heading', { level: 1 })).not.toHaveText('🥗 Mensa')
  await gotoHydrated(page, `/b/${boardId}/settings`)
  await expect(memberRows(page)).toHaveText([/evelyn/])
})

// Permissions (#340): the Owner switches "Gerichte hinzufügen" off in
// Radia's sheet; their open Board loses its add button at its next check,
// and their Board settings show it off, read-only.
test('the Owner switches off adding Dishes for a Member, whose add button goes without a reload', async ({ page, browser }) => {
  const { boardId, radia } = await sharedBoard(page, browser, 'Suppenküche')
  await fastPolls(radia)
  await gotoHydrated(radia, `/b/${boardId}`)
  const addButton = radia.getByRole('button', { name: 'Gericht hinzufügen' })
  await expect(addButton).toBeVisible()

  await gotoHydrated(page, `/b/${boardId}/settings`)
  await page.getByRole('button', { name: 'radia verwalten' }).click()
  const adding = page.getByRole('dialog', { name: 'radia' }).getByRole('group', { name: 'Rechte' }).getByRole('switch', { name: 'Gerichte hinzufügen' })
  await expect(adding).toHaveAttribute('aria-checked', 'true')
  await adding.click()
  await expect(adding).toHaveAttribute('aria-checked', 'false')

  await expect(addButton).toHaveCount(0)
  await gotoHydrated(radia, `/b/${boardId}/settings`)
  const own = radia.getByRole('group', { name: 'Was du hier darfst' }).getByRole('switch', { name: 'Gerichte hinzufügen' })
  await expect(own).toHaveAttribute('aria-checked', 'false')
  await expect(own).toBeDisabled()
})

// Permissions on Dishes (#341): without "Gerichte verschieben" Radia can't
// drag a card and sees no "Gekocht ✓"; without "Gerichte archivieren" the
// "…" menu offers "Archivieren" only on the Dish Radia added.
test('without moving and archiving, a Member can\'t drag or cook, and archives only their own Dishes', async ({ page, browser }) => {
  const { boardId, radia } = await sharedBoard(page, browser, 'Gemüsegarten')
  const addDish = async (on: Page, title: string) =>
    expect((await on.request.post(`/api/boards/${boardId}/dishes`, { data: { title, placeholder: 'bowl' } })).status()).toBe(201)
  await addDish(page, 'Evelyns Kürbissuppe')
  await addDish(radia, 'Radias Rote Bete')
  await fastPolls(radia)
  await gotoHydrated(radia, `/b/${boardId}`)
  const cookButtons = radia.locator('[data-cook]')
  await expect(cookButtons).toHaveCount(2)

  await gotoHydrated(page, `/b/${boardId}/settings`)
  await page.getByRole('button', { name: 'radia verwalten' }).click()
  const rights = page.getByRole('dialog', { name: 'radia' }).getByRole('group', { name: 'Rechte' })
  for (const name of ['Gerichte verschieben', 'Gerichte archivieren']) {
    const permission = rights.getByRole('switch', { name })
    await permission.click()
    await expect(permission).toHaveAttribute('aria-checked', 'false')
  }

  await expect(cookButtons).toHaveCount(0)
  const theirs = radia.getByRole('link', { name: 'Evelyns Kürbissuppe', exact: true })
  const start = (await theirs.boundingBox())!
  await radia.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await radia.mouse.down()
  await radia.mouse.move(start.x + start.width / 2 + 400, start.y + start.height / 2, { steps: 12 })
  await expect(radia.getByTestId('drag-card')).toHaveCount(0)
  await radia.mouse.up()

  await expect(radia.getByRole('button', { name: 'Mehr zu „Evelyns Kürbissuppe“' })).toHaveCount(0)
  await radia.getByRole('button', { name: 'Mehr zu „Radias Rote Bete“' }).click()
  const menu = radia.getByRole('dialog', { name: 'Radias Rote Bete' })
  await expect(menu.getByRole('button', { name: 'Archivieren' })).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Verschieben nach…' })).toHaveCount(0)
  await menu.getByRole('button', { name: 'Schließen' }).click()
  await expect(menu).toHaveCount(0)

  // On a phone a long-press still selects the Dish, to archive it with
  // others, though it doesn't lift.
  await radia.setViewportSize({ width: 390, height: 844 })
  const own = radia.getByRole('link', { name: 'Radias Rote Bete', exact: true })
  const box = (await own.boundingBox())!
  const at = { pointerId: 11, pointerType: 'touch', isPrimary: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true }
  await own.dispatchEvent('pointerdown', at)
  await radia.waitForTimeout(450)
  await expect(radia.getByTestId('drag-card')).toHaveCount(0)
  await radia.getByTestId('columns').dispatchEvent('pointerup', at)
  const bar = radia.getByRole('toolbar', { name: 'Auswahl' })
  await expect(bar.getByRole('button', { name: 'Archivieren' })).toBeVisible()
  await expect(bar.getByRole('button', { name: 'Verschieben' })).toHaveCount(0)
})

// Without "Gerichte bearbeiten" and "Gerichte archivieren" Radia edits, and
// restores from the Archive, only the Dish Radia added.
test('without editing and archiving, a Member edits and restores only their own Dishes', async ({ page, browser }) => {
  const { boardId, radia } = await sharedBoard(page, browser, 'Kräutergarten')
  const addDish = async (on: Page, title: string) => {
    const res = await on.request.post(`/api/boards/${boardId}/dishes`, { data: { title, placeholder: 'bowl' } })
    expect(res.status()).toBe(201)
    return (await res.json() as { id: string }).id
  }
  const theirs = await addDish(page, 'Evelyns Bärlauchpesto')
  const own = await addDish(radia, 'Radias Minztee')
  const { members } = await (await page.request.get(`/api/boards/${boardId}`)).json() as { members: { id: string, name: string }[] }
  const radiaId = members.find(m => m.name === 'radia')!.id
  expect((await page.request.patch(`/api/boards/${boardId}/members/${radiaId}/permissions`, { data: { editDishes: false, archiveDishes: false } })).status()).toBe(200)

  await gotoHydrated(radia, `/b/${boardId}`)
  await radia.getByRole('link', { name: 'Evelyns Bärlauchpesto', exact: true }).click()
  const detail = radia.getByRole('dialog', { name: 'Evelyns Bärlauchpesto' })
  await expect(detail.getByRole('button', { name: 'Gekocht ✓' })).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0)
  await expect(detail.getByRole('button', { name: 'Archivieren' })).toHaveCount(0)
  await gotoHydrated(radia, `/b/${boardId}`)
  await radia.getByRole('link', { name: 'Radias Minztee', exact: true }).click()
  await expect(radia.getByRole('dialog', { name: 'Radias Minztee' }).locator('[data-edit]')).toBeVisible()

  for (const id of [theirs, own]) expect((await page.request.delete(`/api/dishes/${id}`)).status()).toBe(204)
  await gotoHydrated(radia, `/b/${boardId}/settings`)
  await expect(radia.getByRole('button', { name: '„Radias Minztee“ wiederherstellen' })).toBeVisible()
  await expect(radia.locator('[data-archived-dish]')).toHaveCount(2)
  await expect(radia.getByRole('button', { name: '„Evelyns Bärlauchpesto“ wiederherstellen' })).toHaveCount(0)
})

// The id of Radia on the Board, for Evelyn to switch Radia's Permissions.
async function radiaOn(page: Page, boardId: string): Promise<string> {
  const { members } = await (await page.request.get(`/api/boards/${boardId}`)).json() as { members: { id: string, name: string }[] }
  return members.find(m => m.name === 'radia')!.id
}

// Without "Kommentieren und abstimmen" (#342) Radia reads the Verlauf,
// Evelyn's Comment included, but has no comment field and no 👍/👎.
test('without commenting and voting, a Member reads the Verlauf but has no comment field', async ({ page, browser }) => {
  const { boardId, radia } = await sharedBoard(page, browser, 'Teestube')
  const added = await page.request.post(`/api/boards/${boardId}/dishes`, { data: { title: 'Evelyns Chai', placeholder: 'bowl' } })
  expect(added.status()).toBe(201)
  const { id: dishId } = await added.json() as { id: string }
  expect((await page.request.post(`/api/dishes/${dishId}/cook`)).status()).toBe(200)
  expect((await page.request.post(`/api/dishes/${dishId}/comments`, { data: { text: 'Mit viel Kardamom' } })).status()).toBe(201)
  expect((await page.request.patch(`/api/boards/${boardId}/members/${await radiaOn(page, boardId)}/permissions`, { data: { commentAndVote: false } })).status()).toBe(200)

  await gotoHydrated(radia, `/b/${boardId}`)
  await radia.getByRole('link', { name: 'Evelyns Chai', exact: true }).click()
  const history = radia.getByRole('dialog', { name: 'Evelyns Chai' }).locator('[data-dish-history]')
  await expect(history.locator('[data-comment]')).toHaveText([/Mit viel Kardamom/])
  await expect(history.locator('[data-cooking]')).toHaveCount(1)
  await expect(history.getByRole('textbox', { name: 'Kommentar' })).toHaveCount(0)
  await expect(history.locator('[data-how-was-it]')).toHaveCount(0)
})

// Without "Spalten bearbeiten", "Einladungslink teilen" and "Name und Emoji"
// (#342) Radia's Board settings show the name, emoji and Columns without a
// way to change them, and no Invite Link; the Board has no add-Column lane,
// which comes back at the next check once Evelyn switches it on again.
test('without Columns, the Invite Link and the Board name, a Member\'s settings only show them', async ({ page, browser }) => {
  const { boardId, radia } = await sharedBoard(page, browser, 'Vorratskammer')
  const radiaId = await radiaOn(page, boardId)
  expect((await page.request.patch(`/api/boards/${boardId}/members/${radiaId}/permissions`, { data: { editColumns: false, shareInvite: false, editBoard: false } })).status()).toBe(200)

  await gotoHydrated(radia, `/b/${boardId}/settings`)
  await expect(radia.getByRole('textbox', { name: 'Name' })).toHaveValue('Vorratskammer')
  await expect(radia.getByRole('textbox', { name: 'Name' })).not.toBeEditable()
  await expect(radia.getByRole('button', { name: 'Emoji ändern' })).toHaveCount(0)
  await expect(radia.getByRole('img', { name: 'Emoji ändern: 🥗' })).toBeVisible()
  await expect(radia.getByRole('list', { name: 'Spalten' }).getByRole('listitem')).toHaveCount(3)
  await expect(radia.locator('[data-grip]')).toHaveCount(0)
  await expect(radia.getByRole('textbox', { name: 'Neue Spalte' })).toHaveCount(0)
  await expect(radia.getByRole('heading', { name: 'Einladen' })).toHaveCount(0)
  await expect(radia.getByRole('textbox', { name: 'Einladungslink' })).toHaveCount(0)
  const own = radia.getByRole('group', { name: 'Was du hier darfst' })
  for (const name of ['Spalten bearbeiten', 'Einladungslink teilen', 'Name und Emoji']) {
    await expect(own.getByRole('switch', { name })).toHaveAttribute('aria-checked', 'false')
  }

  await fastPolls(radia)
  await gotoHydrated(radia, `/b/${boardId}`)
  await expect(radia.getByRole('button', { name: 'Neue Spalte' })).toHaveCount(0)
  expect((await page.request.patch(`/api/boards/${boardId}/members/${radiaId}/permissions`, { data: { editColumns: true } })).status()).toBe(200)
  await expect(radia.getByRole('button', { name: 'Neue Spalte' })).toBeVisible()
})
