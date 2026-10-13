// A Username's rules (CONTEXT.md), the same in the browser (as you type)
// and on the server (PUT /api/me/username): 2–24 characters, each a letter
// (umlauts and other alphabets included), a digit, `_`, `.` or `-`.
export const USERNAME_MIN = 2
export const USERNAME_MAX = 24

const ALLOWED = /^[\p{L}\p{M}\d_.-]*$/u

export type UsernameProblem = 'short' | 'long' | 'characters'

// A typed Username as it is checked and saved: without the spaces around
// it, and "ä" always as one character, however the keyboard sent it.
export function typedUsername(typed: string): string {
  return typed.normalize('NFC').trim()
}

// What is wrong with a Username (already through typedUsername), or null.
export function usernameProblem(username: string): UsernameProblem | null {
  if (!ALLOWED.test(username)) return 'characters'
  const length = [...username].length
  if (length < USERNAME_MIN) return 'short'
  return length > USERNAME_MAX ? 'long' : null
}

// What the app asks a signed-in user about their Username before they reach
// a Board: to pick one (a new user has none), or once whether the one their
// Google first name gave them fits (a user from before Usernames).
export type UsernamePrompt = 'pick' | 'confirm'
