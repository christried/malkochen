// Relative import, not `~`: the client tests run in plain Node.
import { webLink } from './web-link'

// Share to malkochen (issue #204): what Android hands the share target
// (manifest share_target), each part as the sharing app filled it in.
export type SharedContent = {
  url?: string
  text?: string
  title?: string
}

// A web link inside free text: up to the next space or quote. Punctuation
// that ends a sentence or closes brackets isn't part of it.
const LINK_IN_TEXT = /https?:\/\/[^\s"'<>„“”«»]+/i
const TRAILING = /[.,;:!?)\]}]+$/

function firstLink(value: string | undefined): string | null {
  const found = value?.match(LINK_IN_TEXT)?.[0].replace(TRAILING, '')
  return found ? webLink(found) : null
}

// The link to add: the first http(s) link in the URL, else the text, else
// the title (apps differ in where they put it). Null without one.
export function sharedLink({ url, text, title }: SharedContent): string | null {
  return firstLink(url) ?? firstLink(text) ?? firstLink(title)
}

// Where sign-in returns to: the share route with what was shared, so the
// link survives the trip; anything else goes to the Board used last.
export function shareReturnPath(path: string | undefined): string {
  return path === '/share' || path?.startsWith('/share?') ? path : '/'
}
