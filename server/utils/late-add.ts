import type { z } from 'zod'
import type { Language } from '../../shared/language'
import { guessSource } from '../source-lookup'
import { nothingFound } from '../source-lookup/types'
import { sourceOf, type offlineAddBody } from './dish-input'
import { dishWithSource, type DuplicateDish, type NewDish } from './dishes'
import { copyImage } from './image-store'
import { spendRateLimitIfWithin } from './rate-limit'
import { playableFor } from './playable-video'
import { lookupSource } from './source-lookup'
import { titleFromSource } from './source-title'

// A Dish added offline (#462; ADR 0012) arrives with its link and maybe a
// title, no more. This makes the Dish the online form would have made: the
// same Source Lookup (image copied into the Image Store, Creator, Caption,
// whether a video plays, Suggested Title), run now, and the duplicate-Source
// check, which the Member couldn't be asked.
//
// A Dish that has arrived must be kept, so the rate limits (server/rate-limits.ts)
// never refuse it: over the limit it is added without the costly part, the
// lookup ('source-lookup') or the image copy ('add-dish'), and so with its
// Placeholder Image and a title made from the link. A lookup that finds
// nothing does the same.
//
// The title: the one typed; else the Suggested Title; else one made from the
// Source's platform and Creator, in the adder's language.

export async function dishFromLateAdd(
  userId: string,
  boardId: string,
  language: Language,
  body: z.output<typeof offlineAddBody>,
): Promise<{ dish: NewDish, duplicate: DuplicateDish | null }> {
  const link = body.source?.link
  if (!link) return { dish: { ...bare(body.placeholder), title: body.title! }, duplicate: null }

  const mayLookUp = await spendRateLimitIfWithin(userId, 'source-lookup')
  const mayCopy = await spendRateLimitIfWithin(userId, 'add-dish')
  const found = mayLookUp ? await lookupSource(link) : nothingFound(guessSource(link))
  const source = sourceOf({ link: found.canonicalLink, kind: found.kind })
  const duplicate = await dishWithSource(boardId, source.link)
  const imageUrl = mayCopy && found.imageUrl ? await copyImage(found.imageUrl) : null
  const creator = found.creator
  return {
    duplicate,
    dish: {
      ...bare(body.placeholder),
      title: body.title ?? (found.suggestedTitle.slice(0, 200) || titleFromSource(language, source, creator)),
      source,
      creator,
      caption: found.caption,
      playableVideo: playableFor(source, found.playableVideo),
      imageUrl,
    },
  }
}

// A Dish with no Source: nothing looked up.
function bare(placeholder: NewDish['placeholder']): NewDish {
  return { title: '', source: null, creator: null, caption: null, playableVideo: null, imageUrl: null, imageIsOwnPhoto: false, placeholder }
}
