import { and, eq, isNull } from 'drizzle-orm'
import type { Placeholder } from '../../shared/placeholders'
import type { ImageFocus } from '../../shared/image-focus'
import { db } from '../db'
import { board, dish } from '../db/schema'
import { accessOn } from './board-access'
import { slugOf } from './addresses'
import { addDish, type DishSource, type PlacedDish } from './dishes'
import type { shownAs } from './people'
import { storage } from './image-store'

// A Copy (CONTEXT.md: Copy, #402): a new Dish on another of the user's Boards,
// made from one they can see. It takes the Dish's title, Source, Creator,
// Caption, image, Focus Point and Placeholder; not its Cookings, Comments or
// Votes. The copier adds it, so it is theirs and New Dish for the target's
// Members, like any added Dish.

type Copier = Parameters<typeof shownAs>[0]

export interface CopySource {
  id: string
  boardId: string
  title: string
  source: DishSource | null
  creator: string | null
  caption: string | null
  playableVideo: boolean | null
  imageUrl: string | null
  imageFocus: ImageFocus
  placeholder: Placeholder
}

// The live Dish `dishId`, if the user may see it: not archived, on a Board
// that isn't archived, and on a Board they are a Member of (accessOn decides
// that). Null otherwise, which the route answers "not found".
export async function copySourceById(dishId: string, userId: string): Promise<CopySource | null> {
  const [found] = await db
    .select({
      id: dish.id,
      boardId: dish.boardId,
      title: dish.title,
      sourceLink: dish.sourceLink,
      sourceKind: dish.sourceKind,
      creator: dish.creator,
      caption: dish.caption,
      playableVideo: dish.playableVideo,
      imageUrl: dish.imageUrl,
      imageFocusX: dish.imageFocusX,
      imageFocusY: dish.imageFocusY,
      placeholder: dish.placeholder,
    })
    .from(dish)
    .innerJoin(board, eq(board.id, dish.boardId))
    .where(and(eq(dish.id, dishId), isNull(dish.deletedAt), isNull(board.deletedAt)))
  if (!found) return null
  const [access] = await accessOn(found.boardId, userId)
  if (!access) return null
  const { sourceLink, sourceKind, imageFocusX, imageFocusY, ...rest } = found
  return {
    ...rest,
    source: sourceLink && sourceKind ? { link: sourceLink, kind: sourceKind } : null,
    imageFocus: { x: imageFocusX, y: imageFocusY },
  }
}

// The image a Copy gets: a copy of the stored one, under a new name, so
// purging either Dish never removes the other's file. A Placeholder (no
// image) is simply the same Placeholder. A failed copy gives the Copy its
// Placeholder instead, which `imageCopied: false` says.
async function copyImageOf(imageUrl: string | null): Promise<{ imageUrl: string | null, imageCopied: boolean }> {
  if (!imageUrl) return { imageUrl: null, imageCopied: true }
  try {
    return { imageUrl: await storage.copy(imageUrl), imageCopied: true }
  }
  catch (error) {
    // The Member only sees the notice; the reason goes to the runtime logs.
    console.warn(`[image-store] not copied: ${error instanceof Error ? error.message : String(error)} (${imageUrl})`)
    return { imageUrl: null, imageCopied: false }
  }
}

export interface CopiedDish {
  dish: PlacedDish
  board: { id: string, slug: string, name: string, emoji: string }
  imageCopied: boolean
}

// Makes a Copy of the Dish `sourceDishId` on the Board `toBoardId`, added by
// `copier`. Null if the source is not visible to the copier. 'same-board' if
// the target is the source's own Board (a Copy is for another Board). The
// target's Permissions are checked by the route before this.
export async function copyDish(sourceDishId: string, copier: Copier, toBoardId: string): Promise<CopiedDish | 'same-board' | null> {
  const source = await copySourceById(sourceDishId, copier.id)
  if (!source) return null
  if (source.boardId === toBoardId) return 'same-board'

  const { imageUrl, imageCopied } = await copyImageOf(source.imageUrl)
  const added = await addDish(toBoardId, copier, {
    title: source.title,
    source: source.source,
    creator: source.creator,
    caption: source.caption,
    playableVideo: source.playableVideo,
    imageUrl,
    imageFocus: source.imageFocus,
    placeholder: source.placeholder,
  }, { copiedFrom: source.id })
  if (!added) return null

  const [target] = await db.select({ id: board.id, slug: slugOf, name: board.name, emoji: board.emoji }).from(board).where(eq(board.id, toBoardId))
  if (!target) return null
  return { dish: added, board: target, imageCopied }
}
