import { z } from 'zod'
import { PLACEHOLDERS } from '../../../../shared/placeholders'
import { guessSource, SOURCE_KINDS, type SourceKind } from '../../../source-lookup'
import { isMember } from '../../../utils/boards'
import { addDish, type DishSource } from '../../../utils/dishes'
import { copyImage } from '../../../utils/image-store'

const webLink = z.url({ protocol: /^https?$/ }).max(2048)

const body = z.object({
  title: z.string().trim().min(1).max(200),
  // Optional; a blank note is no note.
  note: z.string().trim().max(2000).nullish().transform(note => note || null),
  // The fallback image, and the image if there is no Source image.
  placeholder: z.enum(PLACEHOLDERS),
  // The canonical link and kind from Source Lookup. The kind is read from the
  // link itself; the one sent only tells a blog from any other web page.
  source: z.object({ link: webLink, kind: z.enum(SOURCE_KINDS).optional() }).nullish(),
  // The Source image Source Lookup found (third-party); copied on save.
  imageUrl: webLink.nullish(),
})

function sourceOf(input: { link: string, kind?: SourceKind }): DishSource {
  const guess = guessSource(input.link)
  const isBlog = guess.kind === 'other' && input.kind === 'blog'
  return { link: guess.canonicalLink, kind: isBlog ? 'blog' : guess.kind }
}

// POST /api/boards/:id/dishes — adds a Dish at the top of the Board's first
// Column: from a link (Source and Source image), or without one ("Ohne Link
// hinzufügen"). The Source image is copied into the Image Store; if that
// fails, the Dish keeps its Placeholder Image.
export default defineEventHandler(async (event) => {
  const boardId = boardIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A title and a Placeholder Image are required' })
  const user = requireUser(event)
  // Before copying anything: non-Members must not fill our storage.
  if (!await isMember(boardId, user.id)) throw boardNotFound()

  const { source, imageUrl, ...rest } = parsed.data
  const created = await addDish(boardId, user, {
    ...rest,
    source: source ? sourceOf(source) : null,
    imageUrl: imageUrl ? await copyImage(imageUrl) : null,
  })
  if (!created) throw boardNotFound()
  setResponseStatus(event, 201)
  return created
})
