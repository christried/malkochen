import { z } from 'zod'
import { SHOPPING_LIMITS } from '../../shared/shopping-list'

// A Shopping Item's text as a write takes it: trimmed, 1 to 200 characters
// (shared/shopping-list.ts).
export const shoppingText = z.string().trim().min(1).max(SHOPPING_LIMITS.characters)
