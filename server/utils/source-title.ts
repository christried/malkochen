import { stringsFor } from '../../app/strings'
import { siteOf } from '../../shared/link-guess'
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

