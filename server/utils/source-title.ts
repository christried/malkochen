import { stringsFor } from '../../app/strings'
import type { Language } from '../../shared/language'
import type { DishSource } from './dishes'

// The title of a Dish added offline whose Source showed none (CONTEXT.md:
// Suggested Title): after the Source's platform and Creator ("TikTok von
// @mara.kocht", "TikTok-Video"), in the language of whoever added it, as
// other server-made copy. A web page without a Creator is titled after its
// site.
export function titleFromSource(language: Language, source: DishSource, creator: string | null): string {
  return stringsFor(language).addDish.sourceTitle(source.kind, creator, siteOf(source.link))
}

// The link's site as the card shows it until the Dish has arrived
// ("kochblog.example"): its host without a leading "www." or "m.".
function siteOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^(www|m)\./, '')
  }
  catch {
    return ''
  }
}
