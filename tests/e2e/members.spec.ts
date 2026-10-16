import type { Browser, Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { inviteToken } from './invite'

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
