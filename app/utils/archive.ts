// The Board's Archive in Board Settings (#336; CONTEXT.md: Archived Dish).

const DAY_MS = 24 * 60 * 60 * 1000

// The days an Archived Dish has left before the cleanup purges it
// (`purgesAt`, as the server answers it: 30 calendar days after it was
// archived), to the nearest whole day, so a change of daylight saving time
// in between doesn't add one. At least one while it is still listed: the
// daily cleanup takes it some hours after its time.
export function daysLeft(purgesAt: string, now = new Date()): number {
  return Math.max(1, Math.round((new Date(purgesAt).getTime() - now.getTime()) / DAY_MS))
}
