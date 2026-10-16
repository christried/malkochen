import { createInstagramPlayCheck, createSourceLookup, type InstagramPlayCheck, type SourceLookup } from '../source-lookup'

// The app's one Source Lookup. Swapping in a paid unfurl service means
// changing only this line.
export const lookupSource: SourceLookup = createSourceLookup()

// What Instagram said about a post, kept for a few hours per server
// instance, so a Dish detail opened again doesn't ask Instagram again. Only
// answers are kept: an unknown one is asked again next time.
const CACHE_MS = 6 * 60 * 60 * 1000
const MAX_CACHED = 500
const cachedAnswers = new Map<string, { playsInPlace: boolean, at: number }>()
const checkInstagram: InstagramPlayCheck = createInstagramPlayCheck()

export async function instagramPlaysInPlace(link: string): Promise<boolean | null> {
  const known = cachedAnswers.get(link)
  if (known && Date.now() - known.at < CACHE_MS) return known.playsInPlace
  const playsInPlace = await checkInstagram(link)
  if (playsInPlace !== null) {
    cachedAnswers.delete(link)
    if (cachedAnswers.size >= MAX_CACHED) cachedAnswers.delete(cachedAnswers.keys().next().value!)
    cachedAnswers.set(link, { playsInPlace, at: Date.now() })
  }
  return playsInPlace
}
