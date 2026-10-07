// Which "never cooked" scene a Dish's Cooking History shows until it is
// cooked (Round 11's three, handoff README §7): Topfbert tipping his hat as
// the pea pops out of the pot, Schoti leaping over the pea, or Knobi riding
// Topfbert's steam. Picked by the Dish's id, as the handoff has it
// (`[hut, sprung, dampf][hash(dishId) % 3]`), so a Dish keeps its scene
// across reloads and for every Member, and Dishes differ.
import { hashString } from './seeded'

export const NEVER_COOKED_SCENES = ['never-cooked-hut', 'never-cooked-sprung', 'never-cooked-dampf'] as const
export type NeverCookedScene = typeof NEVER_COOKED_SCENES[number]

export function neverCookedScene(dishId: string): NeverCookedScene {
  return NEVER_COOKED_SCENES[hashString(dishId) % NEVER_COOKED_SCENES.length]!
}
