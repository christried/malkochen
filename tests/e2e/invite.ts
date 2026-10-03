import type { Page } from '@playwright/test'

// The Board's Invite Link token, as any of its Members reads it.
export async function inviteToken(page: Page, boardId: string): Promise<string> {
  const { inviteToken } = await (await page.request.get(`/api/boards/${boardId}`)).json() as { inviteToken: string }
  return inviteToken
}
