import { createSourceLookup, type SourceLookup } from '../source-lookup'

// The app's one Source Lookup. Swapping in a paid unfurl service means
// changing only this line.
export const lookupSource: SourceLookup = createSourceLookup()
