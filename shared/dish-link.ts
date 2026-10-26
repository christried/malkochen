import { slugify } from './address'
import { SECRET } from './invite'

// Dish Links (CONTEXT.md: Dish Link): /d/<title slug>-<secret>. Only the
// secret counts: the slug part only makes the link readable, so renaming the
// Dish never breaks a link sent before. The secret is the same kind as an
// Invite Link's (shared/invite.ts).

export function dishLinkPath(dish: { title: string, linkSecret: string }): string {
  const title = slugify(dish.title)
  return title ? `/d/${title}-${dish.linkSecret}` : `/d/${dish.linkSecret}`
}

// The secret a Dish Link's last part ends in, or null if it can't be one.
export function dishLinkSecret(segment: string): string | null {
  const secret = segment.slice(segment.lastIndexOf('-') + 1).toLowerCase()
  return SECRET.test(secret) ? secret : null
}
