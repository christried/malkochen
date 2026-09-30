import { expect, test } from 'vitest'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Duplicate-Source detection (PRD story 24): before saving, Add Dish asks
// whether the link's canonical form is already on the chosen Board.

interface Duplicate {
  duplicate: { id: string, title: string, columnName: string } | null
}

async function landingBoardId(caller: Caller): Promise<string> {
  return ((await (await caller.fetch('/api/boards/landing')).json()) as { boardId: string }).boardId
}

async function addDish(caller: Caller, boardId: string, title: string, link: string) {
  const res = await caller.fetch(`/api/boards/${boardId}/dishes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title, placeholder: 'bowl', source: { link } }),
  })
  expect(res.status).toBe(201)
  return (await res.json()) as { id: string }
}

function checkDuplicate(caller: Caller, boardId: string, link: string) {
  return caller.fetch(`/api/boards/${boardId}/duplicate?link=${encodeURIComponent(link)}`)
}

async function duplicateOf(caller: Caller, boardId: string, link: string) {
  const res = await checkDuplicate(caller, boardId, link)
  expect(res.status).toBe(200)
  return ((await res.json()) as Duplicate).duplicate
}

test('a link already on the Board names the Dish and its Column', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoardId(ada)
  const link = 'https://www.youtube.com/shorts/dupCrispyTofu1'

  expect(await duplicateOf(ada, board, link)).toBeNull()
  const saved = await addDish(ada, board, 'Crispy Tofu', link)

  expect(await duplicateOf(ada, board, link)).toEqual({ id: saved.id, title: 'Crispy Tofu', columnName: 'Ideen' })
})

test('another form of the same link is the same Source', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoardId(ada)
  const saved = await addDish(ada, board, 'Ramen', 'https://www.instagram.com/reel/DupRamen42/')

  for (const other of [
    'https://instagram.com/reel/DupRamen42?igsh=abc123',
    'https://www.instagram.com/reels/DupRamen42/?utm_source=ig_web_copy_link',
  ]) {
    expect(await duplicateOf(ada, board, other)).toMatchObject({ id: saved.id, title: 'Ramen' })
  }
  expect(await duplicateOf(ada, board, 'https://www.instagram.com/reel/DupRamen43/')).toBeNull()
})

test('duplicates are per Board: the same link on another Board is no duplicate', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const grace = await signIn(ALLOWLISTED[1])
  const link = 'https://www.youtube.com/shorts/dupPerBoard01'
  await addDish(ada, await landingBoardId(ada), 'Dal', link)

  expect(await duplicateOf(grace, await landingBoardId(grace), link)).toBeNull()
})

test('saving anyway adds a second Dish; the newest one is named', async () => {
  const grace = await signIn(ALLOWLISTED[1])
  const board = await landingBoardId(grace)
  const link = 'https://www.youtube.com/shorts/dupTwice00001'
  await addDish(grace, board, 'Shakshuka', link)

  const second = await addDish(grace, board, 'Shakshuka, die Zweite', `${link}?feature=share`)

  expect(await duplicateOf(grace, board, link)).toEqual({ id: second.id, title: 'Shakshuka, die Zweite', columnName: 'Ideen' })
})

test('only Members can ask, and only about web links', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const linus = await signIn(ALLOWLISTED[2])
  const adasBoard = await landingBoardId(ada)

  expect((await checkDuplicate(linus, adasBoard, 'https://www.youtube.com/shorts/dupCrispyTofu1')).status).toBe(404)
  expect((await checkDuplicate(ada, adasBoard, 'javascript:alert(1)')).status).toBe(400)
  expect((await ada.fetch(`/api/boards/${adasBoard}/duplicate`)).status).toBe(400)
})
