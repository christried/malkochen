import { describe, expect, test } from 'vitest'
import { createRecipeFinder, heldToLimits, linkInCaption } from '../../server/recipe-finder'
import type { ReadResult, RecipeReader } from '../../server/recipe-finder/model'
import type { DestinationLookup, DestinationLookupResult, PageLookup, PageLookupResult, RecipeLookup, RecipeLookupResult } from '../../server/source-lookup'

// The Recipe Finder (CONTEXT.md, #500, #501, #502), given fakes of its four
// dependencies (the recipe lookup of the Source's page, the reader of Captions
// and pages, the lookups of a followed page and of a Pin's destination): what
// it answers for each way its steps can end, in which order they are taken,
// that the model is only asked when the page had no recipe data, that what it
// found is held to a Recipe's limits, and that a search follows at most one
// page and asks the model at most twice.

const SOURCE = { link: 'https://kochblog.example/linsensuppe', kind: 'blog', caption: null } as const
const CAPTION = 'Linsensuppe: 250 g Linsen, 1 Zwiebel. Alles kochen.'
const WITH_CAPTION = { ...SOURCE, caption: CAPTION }
const READ: ReadResult = { outcome: 'read', ingredients: ['250 g Linsen', '1 Zwiebel'], steps: ['Alles kochen.'], link: null }

type Reading = ReadResult | ((text: { from: 'caption' | 'page', text: string }) => Promise<ReadResult>)

// A finder with fakes for all four dependencies. Whatever is not given
// answers "nothing there" (the page has no recipe data, the Source has no
// destination) and the followed page is unreadable.
function finderWith(
  answer: RecipeLookupResult | (() => Promise<RecipeLookupResult>),
  reading: Reading | null = null,
  { page = { outcome: 'unreadable' }, destination = { outcome: 'none' } }: {
    page?: PageLookupResult | (() => Promise<PageLookupResult>)
    destination?: DestinationLookupResult | (() => Promise<DestinationLookupResult>)
  } = {},
) {
  const asked: string[] = []
  const read: { from: 'caption' | 'page', text: string }[] = []
  const followed: string[] = []
  const destinations: string[] = []
  const lookupRecipe: RecipeLookup = async (link) => {
    asked.push(link)
    return typeof answer === 'function' ? answer() : answer
  }
  const readRecipe: RecipeReader | null = reading === null
    ? null
    : async (text) => {
        read.push(text)
        return typeof reading === 'function' ? reading(text) : reading
      }
  const lookupPage: PageLookup = async (link) => {
    followed.push(link)
    return typeof page === 'function' ? page() : page
  }
  const lookupDestination: DestinationLookup = async (link) => {
    destinations.push(link)
    return typeof destination === 'function' ? destination() : destination
  }
  return { find: createRecipeFinder({ lookupRecipe, readRecipe, lookupPage, lookupDestination }), asked, read, followed, destinations }
}

describe('the recipe data of the Source\'s page', () => {
  test('a Recipe the page carries is found, with no link of another page', async () => {
    const { find, asked } = finderWith({ outcome: 'found', recipe: { ingredients: ['250 g Linsen'], steps: ['Kochen.'] } })

    expect(await find(SOURCE)).toEqual({ outcome: 'found', recipe: { ingredients: ['250 g Linsen'], steps: ['Kochen.'] }, link: null })
    expect(asked).toEqual([SOURCE.link])
  })

  test('a page without one finds none', async () => {
    expect(await finderWith({ outcome: 'none' }).find(SOURCE)).toEqual({ outcome: 'none' })
  })

  test('a page that can\'t be read is a failed search', async () => {
    expect(await finderWith({ outcome: 'unreadable' }).find(SOURCE)).toEqual({ outcome: 'failed' })
  })

  test('it never rejects: a lookup that throws is a failed search', async () => {
    const { find } = finderWith(() => Promise.reject(new Error('boom')))

    expect(await find(SOURCE)).toEqual({ outcome: 'failed' })
  })
})

describe('what it found is held to the Recipe\'s limits', () => {
  test('lines are trimmed and empty ones dropped', async () => {
    const { find } = finderWith({ outcome: 'found', recipe: { ingredients: ['  200 g Mehl ', '', '   '], steps: ['', ' Rühren. '] } })

    expect(await find(SOURCE)).toMatchObject({ outcome: 'found', recipe: { ingredients: ['200 g Mehl'], steps: ['Rühren.'] } })
  })

  test('a list over its line limit is cut to it: 60 Ingredients, 40 Steps', async () => {
    const ingredients = Array.from({ length: 70 }, (_, i) => `Zutat ${i}`)
    const steps = Array.from({ length: 50 }, (_, i) => `Schritt ${i}`)
    const { find } = finderWith({ outcome: 'found', recipe: { ingredients, steps } })

    expect(await find(SOURCE)).toMatchObject({ outcome: 'found', recipe: { ingredients: ingredients.slice(0, 60), steps: steps.slice(0, 40) } })
  })

  test('a line over its character limit is cut to it: 200 for an Ingredient, 1000 for a Step', async () => {
    const { find } = finderWith({ outcome: 'found', recipe: { ingredients: ['z'.repeat(300)], steps: ['ß'.repeat(1200)] } })

    expect(await find(SOURCE)).toMatchObject({ outcome: 'found', recipe: { ingredients: ['z'.repeat(200)], steps: ['ß'.repeat(1000)] } })
  })

  test('a Recipe that is empty after trimming is none', async () => {
    const { find } = finderWith({ outcome: 'found', recipe: { ingredients: [' ', ''], steps: ['\n'] } })

    expect(await find(SOURCE)).toEqual({ outcome: 'none' })
  })

  test('lines at the limits are kept whole', () => {
    const ingredients = Array.from({ length: 60 }, (_, i) => `${i}`.padEnd(200, 'z'))
    const steps = Array.from({ length: 40 }, (_, i) => `${i}`.padEnd(1000, 'ß'))

    expect(heldToLimits({ ingredients, steps })).toEqual({ ingredients, steps })
  })
})

describe('the Caption, read when the page had no recipe data', () => {
  test('a Recipe the model reads in the Caption is found, with no link', async () => {
    const { find, read } = finderWith({ outcome: 'none' }, READ)

    expect(await find(WITH_CAPTION)).toEqual({ outcome: 'found', recipe: { ingredients: ['250 g Linsen', '1 Zwiebel'], steps: ['Alles kochen.'] }, link: null })
    expect(read).toEqual([{ from: 'caption', text: CAPTION }])
  })

  test('the model is not asked when the page had recipe data', async () => {
    const { find, read } = finderWith({ outcome: 'found', recipe: { ingredients: ['250 g Linsen'], steps: [] } }, READ)

    expect(await find(WITH_CAPTION)).toMatchObject({ outcome: 'found', recipe: { ingredients: ['250 g Linsen'], steps: [] } })
    expect(read).toEqual([])
  })

  test('a page that can\'t be read does not stop the Caption from being read', async () => {
    const { find } = finderWith({ outcome: 'unreadable' }, READ)

    expect(await find(WITH_CAPTION)).toMatchObject({ outcome: 'found', recipe: { steps: ['Alles kochen.'] } })
  })

  test('an empty answer from the model finds none', async () => {
    const { find } = finderWith({ outcome: 'none' }, { outcome: 'read', ingredients: [], steps: [], link: null })

    expect(await find(WITH_CAPTION)).toEqual({ outcome: 'none' })
  })

  test('a page without recipe data and a failed model is a failed search', async () => {
    const { find } = finderWith({ outcome: 'none' }, { outcome: 'failed' })

    expect(await find(WITH_CAPTION)).toEqual({ outcome: 'failed' })
  })

  test('a page that can\'t be read and a Caption without a Recipe is a failed search: another try may read the page', async () => {
    const { find } = finderWith({ outcome: 'unreadable' }, { outcome: 'read', ingredients: [], steps: [], link: null })

    expect(await find(WITH_CAPTION)).toEqual({ outcome: 'failed' })
  })

  test('a page that can\'t be read and a failed model is a failed search', async () => {
    expect(await finderWith({ outcome: 'unreadable' }, { outcome: 'failed' }).find(WITH_CAPTION)).toEqual({ outcome: 'failed' })
  })

  test('a page that can\'t be read and no Caption is a failed search', async () => {
    expect(await finderWith({ outcome: 'unreadable' }, READ).find(SOURCE)).toEqual({ outcome: 'failed' })
  })

  test('no Caption, or a blank one: none, and the model is not asked', async () => {
    for (const caption of [null, '', '  \n ']) {
      const { find, read } = finderWith({ outcome: 'none' }, READ)

      expect(await find({ ...SOURCE, caption })).toEqual({ outcome: 'none' })
      expect(read).toEqual([])
    }
  })

  test('without a reader (no API key) the Caption is not read', async () => {
    expect(await finderWith({ outcome: 'none' }).find(WITH_CAPTION)).toEqual({ outcome: 'none' })
  })

  test('it never rejects: a reader that throws is a failed search', async () => {
    const { find } = finderWith({ outcome: 'none' }, () => Promise.reject(new Error('boom')))

    expect(await find(WITH_CAPTION)).toEqual({ outcome: 'failed' })
  })

  test('the model\'s lines are held to the limits: cut, not kept as they are', async () => {
    const ingredients = Array.from({ length: 70 }, (_, i) => i === 0 ? 'z'.repeat(250) : `Zutat ${i}`)
    const steps = ['ß'.repeat(1100), ' ', 'Fertig.']
    const { find } = finderWith({ outcome: 'none' }, { outcome: 'read', ingredients, steps, link: null })

    const found = await find(WITH_CAPTION)

    expect(found).toMatchObject({ outcome: 'found', link: null })
    if (found.outcome !== 'found') return
    expect(found.recipe.ingredients).toHaveLength(60)
    expect(found.recipe.ingredients[0]).toBe('z'.repeat(200))
    expect(found.recipe.steps).toEqual(['ß'.repeat(1000), 'Fertig.'])
  })

  test('lines that are all empty after trimming are none', async () => {
    const { find } = finderWith({ outcome: 'none' }, { outcome: 'read', ingredients: [' '], steps: [''], link: null })

    expect(await find(WITH_CAPTION)).toEqual({ outcome: 'none' })
  })
})

// The third step (#502): one page to follow, the Pin's destination or the link
// the model named in the Caption.

const BLOG = 'https://tofu-blog.example/knuspriger-tofu'
const CAPTION_WITH_LINK = 'Knuspriger Ofentofu! Das ganze Rezept findest du hier: tofu-blog.example/knuspriger-tofu #tofu'
const POINTS_TO_BLOG: ReadResult = { outcome: 'read', ingredients: [], steps: [], link: 'tofu-blog.example/knuspriger-tofu' }
const PIN_SOURCE = { link: 'https://www.pinterest.com/pin/85779567902561995/', kind: 'pinterest-pin', caption: null } as const
const PAGE_RECIPE: PageLookupResult = { outcome: 'recipe', link: BLOG, recipe: { ingredients: ['400 g Tofu'], steps: ['Backen.'] } }
const PAGE_TEXT: PageLookupResult = { outcome: 'text', link: BLOG, text: 'Knuspriger Ofentofu\n\n400 g Tofu\n\nBacken.' }
const TOFU: ReadResult = { outcome: 'read', ingredients: ['400 g Tofu'], steps: ['Backen.'], link: null }
const FOUND_AT_BLOG = { outcome: 'found', recipe: { ingredients: ['400 g Tofu'], steps: ['Backen.'] }, link: BLOG }

// The reader answers what is asked of it by what the text is.
const readingBy = (answers: { caption: ReadResult, page: ReadResult }): Reading => async ({ from }) => answers[from]

describe('the link the model named in the Caption', () => {
  const FROM_CAPTION = { ...SOURCE, caption: CAPTION_WITH_LINK }

  test('a page with recipe data gives the Recipe, with the link of that page', async () => {
    const { find, followed, read } = finderWith({ outcome: 'none' }, POINTS_TO_BLOG, { page: PAGE_RECIPE })

    expect(await find(FROM_CAPTION)).toEqual(FOUND_AT_BLOG)
    expect(followed).toEqual([BLOG])
    expect(read).toHaveLength(1)
  })

  test('the link of the page is where it was served from, not what the Caption wrote', async () => {
    const { find } = finderWith({ outcome: 'none' }, POINTS_TO_BLOG, { page: { ...PAGE_RECIPE, link: 'https://www.tofu-blog.example/knuspriger-tofu/' } })

    expect(await find(FROM_CAPTION)).toMatchObject({ link: 'https://www.tofu-blog.example/knuspriger-tofu/' })
  })

  test('a page without recipe data has its text read by the model as a page', async () => {
    const { find, read, followed } = finderWith({ outcome: 'none' }, readingBy({ caption: POINTS_TO_BLOG, page: TOFU }), { page: PAGE_TEXT })

    expect(await find(FROM_CAPTION)).toEqual(FOUND_AT_BLOG)
    expect(followed).toEqual([BLOG])
    expect(read).toEqual([{ from: 'caption', text: CAPTION_WITH_LINK }, { from: 'page', text: 'Knuspriger Ofentofu\n\n400 g Tofu\n\nBacken.' }])
  })

  test('a Recipe in the Caption ends the search: the link the model named with it is not followed, and the Recipe keeps none', async () => {
    const { find, followed } = finderWith({ outcome: 'none' }, { ...TOFU, link: 'tofu-blog.example/knuspriger-tofu' }, { page: PAGE_RECIPE })

    expect(await find(FROM_CAPTION)).toEqual({ outcome: 'found', recipe: { ingredients: ['400 g Tofu'], steps: ['Backen.'] }, link: null })
    expect(followed).toEqual([])
  })

  test('the Source page\'s recipe data ends the search before the Caption is read', async () => {
    const { find, read, followed } = finderWith({ outcome: 'found', recipe: { ingredients: ['1 Ei'], steps: [] } }, POINTS_TO_BLOG, { page: PAGE_RECIPE })

    expect(await find(FROM_CAPTION)).toEqual({ outcome: 'found', recipe: { ingredients: ['1 Ei'], steps: [] }, link: null })
    expect(read).toEqual([])
    expect(followed).toEqual([])
  })

  test('a link the model named without a scheme is followed with https://', async () => {
    const { find, followed } = finderWith({ outcome: 'none' }, POINTS_TO_BLOG, { page: PAGE_RECIPE })

    await find(FROM_CAPTION)

    expect(followed).toEqual(['https://tofu-blog.example/knuspriger-tofu'])
  })

  test('a link that is not in the Caption is not looked up: the model made it up or changed it', async () => {
    for (const named of ['https://tofu-blog.example/ein-anderes-rezept', 'https://tofu-blog.example/knuspriger-tofu', 'tofu-blog.example/Knuspriger-Tofu']) {
      const { find, followed } = finderWith({ outcome: 'none' }, { ...POINTS_TO_BLOG, link: named }, { page: PAGE_RECIPE })

      expect(await find({ ...SOURCE, caption: 'Rezept: tofu-blog.example/knuspriger-tofu' }), named).toEqual({ outcome: 'none' })
      expect(followed, named).toEqual([])
    }
  })

  test('the Source\'s own link is not followed', async () => {
    const { find, followed } = finderWith({ outcome: 'none' }, POINTS_TO_BLOG, { page: PAGE_RECIPE })

    expect(await find({ link: 'https://tofu-blog.example/knuspriger-tofu', kind: 'blog', caption: CAPTION_WITH_LINK })).toEqual({ outcome: 'none' })
    expect(followed).toEqual([])
  })

  test('no link named: no page is followed, and the search ends as before', async () => {
    const { find, followed } = finderWith({ outcome: 'none' }, READ, { page: PAGE_RECIPE })

    expect(await find({ ...SOURCE, caption: 'Nichts zu sehen' })).toMatchObject({ outcome: 'found', link: null })
    expect(await finderWith({ outcome: 'none' }, { ...READ, ingredients: [], steps: [] }, { page: PAGE_RECIPE }).find(WITH_CAPTION)).toEqual({ outcome: 'none' })
    expect(followed).toEqual([])
  })

  test('without a Caption nothing is named and nothing followed', async () => {
    const { find, followed, destinations } = finderWith({ outcome: 'none' }, POINTS_TO_BLOG, { page: PAGE_RECIPE })

    expect(await find(SOURCE)).toEqual({ outcome: 'none' })
    expect(followed).toEqual([])
    expect(destinations).toEqual([])
  })
})

describe('the destination of a Pin', () => {
  const DESTINATION: DestinationLookupResult = { outcome: 'found', link: BLOG }
  const PIN_WITH_CAPTION = { ...PIN_SOURCE, caption: 'Ofentofu, Rezept: other.example/anderes-rezept' }
  const NAMES_OTHER: ReadResult = { outcome: 'read', ingredients: [], steps: [], link: 'other.example/anderes-rezept' }

  test('a Pin follows its destination: recipe data gives the Recipe with that page\'s link', async () => {
    const { find, destinations, followed } = finderWith({ outcome: 'none' }, null, { destination: DESTINATION, page: PAGE_RECIPE })

    expect(await find(PIN_SOURCE)).toEqual(FOUND_AT_BLOG)
    expect(destinations).toEqual([PIN_SOURCE.link])
    expect(followed).toEqual([BLOG])
  })

  test('a Pin follows its destination, not the Caption\'s link', async () => {
    const { find, followed, read } = finderWith({ outcome: 'none' }, readingBy({ caption: NAMES_OTHER, page: TOFU }), { destination: DESTINATION, page: PAGE_TEXT })

    expect(await find(PIN_WITH_CAPTION)).toEqual(FOUND_AT_BLOG)
    expect(followed).toEqual([BLOG])
    expect(read.map(r => r.from)).toEqual(['caption', 'page'])
  })

  test('a Pin without a destination falls back to the Caption\'s link', async () => {
    const { find, followed } = finderWith({ outcome: 'none' }, NAMES_OTHER, { destination: { outcome: 'none' }, page: { ...PAGE_RECIPE, link: 'https://other.example/anderes-rezept' } })

    expect(await find(PIN_WITH_CAPTION)).toMatchObject({ outcome: 'found', link: 'https://other.example/anderes-rezept' })
    expect(followed).toEqual(['https://other.example/anderes-rezept'])
  })

  test('a Pin whose destination can\'t be told counts as a failed step, and falls back to the Caption\'s link', async () => {
    const lost = finderWith({ outcome: 'none' }, NAMES_OTHER, { destination: { outcome: 'unreadable' } })
    const saved = finderWith({ outcome: 'none' }, NAMES_OTHER, { destination: { outcome: 'unreadable' }, page: PAGE_RECIPE })

    expect(await lost.find(PIN_WITH_CAPTION)).toEqual({ outcome: 'failed' })
    expect(await saved.find(PIN_WITH_CAPTION)).toMatchObject({ outcome: 'found' })
  })

  test('a Pin\'s destination is followed without a reader, when its page carries recipe data', async () => {
    const { find } = finderWith({ outcome: 'none' }, null, { destination: DESTINATION, page: PAGE_RECIPE })

    expect(await find(PIN_WITH_CAPTION)).toEqual(FOUND_AT_BLOG)
  })

  test('a Pin\'s destination is followed although the model failed on the Caption', async () => {
    const { find } = finderWith({ outcome: 'none' }, readingBy({ caption: { outcome: 'failed' }, page: TOFU }), { destination: DESTINATION, page: PAGE_TEXT })

    expect(await find(PIN_WITH_CAPTION)).toEqual(FOUND_AT_BLOG)
  })

  test('the Pin\'s own link as destination is not followed', async () => {
    const { find, followed } = finderWith({ outcome: 'none' }, null, { destination: { outcome: 'found', link: PIN_SOURCE.link }, page: PAGE_RECIPE })

    expect(await find(PIN_SOURCE)).toEqual({ outcome: 'none' })
    expect(followed).toEqual([])
  })

  test('only a Pin is asked for a destination', async () => {
    const { find, destinations } = finderWith({ outcome: 'none' }, READ, { destination: DESTINATION, page: PAGE_RECIPE })

    await find(WITH_CAPTION)

    expect(destinations).toEqual([])
  })

  test('a destination is not asked for when the Source\'s page or the Caption already gave the Recipe', async () => {
    const fromPage = finderWith({ outcome: 'found', recipe: { ingredients: ['1 Ei'], steps: [] } }, READ, { destination: DESTINATION, page: PAGE_RECIPE })
    const fromCaption = finderWith({ outcome: 'none' }, READ, { destination: DESTINATION, page: PAGE_RECIPE })

    expect(await fromPage.find({ ...PIN_SOURCE, caption: CAPTION })).toMatchObject({ outcome: 'found', link: null })
    expect(await fromCaption.find({ ...PIN_SOURCE, caption: CAPTION })).toMatchObject({ outcome: 'found', link: null })
    expect(fromPage.destinations).toEqual([])
    expect(fromCaption.destinations).toEqual([])
  })
})

describe('what following a page ends in', () => {
  const FROM_CAPTION = { ...SOURCE, caption: CAPTION_WITH_LINK }

  test('a page that can\'t be read is a failed search', async () => {
    expect(await finderWith({ outcome: 'none' }, POINTS_TO_BLOG, { page: { outcome: 'unreadable' } }).find(FROM_CAPTION)).toEqual({ outcome: 'failed' })
  })

  test('a lookup of the page that throws is a failed search', async () => {
    const { find } = finderWith({ outcome: 'none' }, POINTS_TO_BLOG, { page: () => Promise.reject(new Error('boom')) })

    expect(await find(FROM_CAPTION)).toEqual({ outcome: 'failed' })
  })

  test('a lookup of the destination that throws is a failed search', async () => {
    const { find } = finderWith({ outcome: 'none' }, null, { destination: () => Promise.reject(new Error('boom')) })

    expect(await find(PIN_SOURCE)).toEqual({ outcome: 'failed' })
  })

  test('a page whose text the model can\'t read is a failed search', async () => {
    const { find } = finderWith({ outcome: 'none' }, readingBy({ caption: POINTS_TO_BLOG, page: { outcome: 'failed' } }), { page: PAGE_TEXT })

    expect(await find(FROM_CAPTION)).toEqual({ outcome: 'failed' })
  })

  test('a reader that throws on the page is a failed search', async () => {
    const { find } = finderWith({ outcome: 'none' }, async ({ from }) => from === 'caption' ? POINTS_TO_BLOG : Promise.reject(new Error('boom')), { page: PAGE_TEXT })

    expect(await find(FROM_CAPTION)).toEqual({ outcome: 'failed' })
  })

  test('a page whose text holds no recipe finds none', async () => {
    const empty: ReadResult = { outcome: 'read', ingredients: [], steps: [], link: null }
    const { find } = finderWith({ outcome: 'none' }, readingBy({ caption: POINTS_TO_BLOG, page: empty }), { page: PAGE_TEXT })

    expect(await find(FROM_CAPTION)).toEqual({ outcome: 'none' })
  })

  test('a page with no text at all finds none, and the model is not asked about it', async () => {
    const { find, read } = finderWith({ outcome: 'none' }, POINTS_TO_BLOG, { page: { outcome: 'text', link: BLOG, text: '' } })

    expect(await find(FROM_CAPTION)).toEqual({ outcome: 'none' })
    expect(read).toHaveLength(1)
  })

  test('a page with text but no reader to read it finds none', async () => {
    const { find } = finderWith({ outcome: 'none' }, null, { destination: { outcome: 'found', link: BLOG }, page: PAGE_TEXT })

    expect(await find(PIN_SOURCE)).toEqual({ outcome: 'none' })
  })

  test('a page whose recipe data is empty after trimming finds none', async () => {
    const { find } = finderWith({ outcome: 'none' }, POINTS_TO_BLOG, { page: { outcome: 'recipe', link: BLOG, recipe: { ingredients: [' '], steps: [''] } } })

    expect(await find(FROM_CAPTION)).toEqual({ outcome: 'none' })
  })

  test('a failed step before it still counts when the followed page holds none', async () => {
    const { find } = finderWith({ outcome: 'unreadable' }, POINTS_TO_BLOG, { page: { outcome: 'text', link: BLOG, text: '' } })

    expect(await find(FROM_CAPTION)).toEqual({ outcome: 'failed' })
  })

  test('a failed step before it is forgotten when the followed page gives the Recipe', async () => {
    const { find } = finderWith({ outcome: 'unreadable' }, POINTS_TO_BLOG, { page: PAGE_RECIPE })

    expect(await find(FROM_CAPTION)).toEqual(FOUND_AT_BLOG)
  })

  test('the page\'s lines are held to the limits, from its recipe data and from the model alike', async () => {
    const long = { ingredients: ['z'.repeat(300), ' '], steps: Array.from({ length: 50 }, (_, i) => `Schritt ${i}`) }
    const fromData = finderWith({ outcome: 'none' }, POINTS_TO_BLOG, { page: { outcome: 'recipe', link: BLOG, recipe: long } })
    const fromText = finderWith({ outcome: 'none' }, readingBy({ caption: POINTS_TO_BLOG, page: { outcome: 'read', ...long, link: null } }), { page: PAGE_TEXT })

    for (const { find } of [fromData, fromText]) {
      const found = await find(FROM_CAPTION)

      expect(found).toMatchObject({ outcome: 'found', link: BLOG })
      if (found.outcome !== 'found') return
      expect(found.recipe.ingredients).toEqual(['z'.repeat(200)])
      expect(found.recipe.steps).toHaveLength(40)
    }
  })
})

describe('the limits of a search', () => {
  test('one page is followed and the model asked twice at most, whatever the page and the model name', async () => {
    const further = 'https://weiter.example/noch-ein-rezept'
    const text: PageLookupResult = { outcome: 'text', link: BLOG, text: `Siehe auch ${further}` }
    const names = readingBy({
      caption: { outcome: 'read', ingredients: [], steps: [], link: 'tofu-blog.example/knuspriger-tofu' },
      page: { outcome: 'read', ingredients: [], steps: [], link: further },
    })
    const { find, followed, read, destinations } = finderWith({ outcome: 'none' }, names, { page: text })

    expect(await find({ ...SOURCE, caption: `${CAPTION_WITH_LINK} ${further}` })).toEqual({ outcome: 'none' })

    expect(followed).toEqual([BLOG])
    expect(read.map(r => r.from)).toEqual(['caption', 'page'])
    expect(destinations).toEqual([])
  })

  test('a Pin\'s search follows one page and asks the model twice at most, too', async () => {
    const { find, followed, read, destinations } = finderWith({ outcome: 'none' }, readingBy({
      caption: { outcome: 'read', ingredients: [], steps: [], link: 'tofu-blog.example/knuspriger-tofu' },
      page: { outcome: 'read', ingredients: [], steps: [], link: 'tofu-blog.example/knuspriger-tofu' },
    }), { page: PAGE_TEXT, destination: { outcome: 'found', link: 'https://pin-ziel.example/rezept' } })

    expect(await find({ ...PIN_SOURCE, caption: CAPTION_WITH_LINK })).toEqual({ outcome: 'none' })

    expect(followed).toEqual(['https://pin-ziel.example/rezept'])
    expect(read.map(r => r.from)).toEqual(['caption', 'page'])
    expect(destinations).toHaveLength(1)
  })
})

describe('the link the model named, checked against the Caption', () => {
  test('a link written in the Caption is answered as a link', () => {
    expect(linkInCaption('https://tofu-blog.example/rezept', 'Rezept: https://tofu-blog.example/rezept #tofu')).toBe('https://tofu-blog.example/rezept')
  })

  test('the link is trimmed first', () => {
    expect(linkInCaption('  https://tofu-blog.example/rezept\n', 'Rezept: https://tofu-blog.example/rezept')).toBe('https://tofu-blog.example/rezept')
  })

  test('a link without a scheme gets https://', () => {
    expect(linkInCaption('tofu-blog.example/rezept', 'Rezept: tofu-blog.example/rezept')).toBe('https://tofu-blog.example/rezept')
    expect(linkInCaption('www.tofu-blog.example', 'bei www.tofu-blog.example')).toBe('https://www.tofu-blog.example/')
  })

  test('http:// stays http://', () => {
    expect(linkInCaption('http://tofu-blog.example/rezept', 'http://tofu-blog.example/rezept')).toBe('http://tofu-blog.example/rezept')
  })

  test('a link that is not in the Caption exactly as written is null: made up, changed, completed from a name, or in another case', () => {
    const caption = 'Rezept: tofu-blog.example/rezept'
    for (const named of ['https://tofu-blog.example/rezept', 'tofu-blog.example/anderes', 'tofu-blog.example/Rezept', 'tofu-blog', 'tofu-blog.example/rezept/']) {
      expect(linkInCaption(named, caption), named).toBeNull()
    }
  })

  test('nothing named, or only blanks, is null', () => {
    expect(linkInCaption('', 'Rezept: tofu-blog.example/rezept')).toBeNull()
    expect(linkInCaption('  \n', 'Ein  \n Rezept')).toBeNull()
  })

  test('a link of more than 2048 characters is null, even when the Caption holds it', () => {
    const long = `https://tofu-blog.example/${'a'.repeat(2030)}`

    expect(long.length).toBeGreaterThan(2048)
    expect(linkInCaption(long, `Rezept ${long}`)).toBeNull()
    expect(linkInCaption(long.slice(0, 2048), `Rezept ${long}`)).toBe(long.slice(0, 2048))
  })

  test('only an http(s) link with a host that has a dot counts', () => {
    for (const named of ['ftp://tofu-blog.example/x', 'javascript:alert(1)', 'http://localhost/x', 'https://intranet/x', 'file:///etc/passwd', 'mailto:hallo@tofu-blog.example', 'hallo@tofu-blog.example', 'https://nutzer:geheim@tofu-blog.example/x', 'data:text/html,hallo']) {
      expect(linkInCaption(named, `Schau: ${named}`), named).toBeNull()
    }
  })

  test('whether the host is a public one is not its job: that is the page lookup\'s', () => {
    expect(linkInCaption('https://127.0.0.1/x', 'https://127.0.0.1/x')).toBe('https://127.0.0.1/x')
  })
})
