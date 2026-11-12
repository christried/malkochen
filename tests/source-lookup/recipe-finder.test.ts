import { describe, expect, test } from 'vitest'
import { createRecipeFinder, heldToLimits } from '../../server/recipe-finder'
import type { ReadResult, RecipeReader } from '../../server/recipe-finder/model'
import type { RecipeLookup, RecipeLookupResult } from '../../server/source-lookup'

// The Recipe Finder (CONTEXT.md, #500, #501), given a fake recipe lookup and
// a fake reader of Captions: what it answers for each way reading a Source's
// page and its Caption can end, that the model is only asked when the page
// had no recipe data, and that what it found is held to a Recipe's limits.

const SOURCE = { link: 'https://kochblog.example/linsensuppe', kind: 'blog', caption: null } as const
const CAPTION = 'Linsensuppe: 250 g Linsen, 1 Zwiebel. Alles kochen.'
const WITH_CAPTION = { ...SOURCE, caption: CAPTION }
const READ: ReadResult = { outcome: 'read', ingredients: ['250 g Linsen', '1 Zwiebel'], steps: ['Alles kochen.'] }

function finderWith(answer: RecipeLookupResult | (() => Promise<RecipeLookupResult>), reading: ReadResult | (() => Promise<ReadResult>) | null = null) {
  const asked: string[] = []
  const read: string[] = []
  const lookupRecipe: RecipeLookup = async (link) => {
    asked.push(link)
    return typeof answer === 'function' ? answer() : answer
  }
  const readRecipe: RecipeReader | null = reading === null
    ? null
    : async (text) => {
        read.push(text)
        return typeof reading === 'function' ? reading() : reading
      }
  return { find: createRecipeFinder({ lookupRecipe, readRecipe }), asked, read }
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
    expect(read).toEqual([CAPTION])
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
    const { find } = finderWith({ outcome: 'none' }, { outcome: 'read', ingredients: [], steps: [] })

    expect(await find(WITH_CAPTION)).toEqual({ outcome: 'none' })
  })

  test('a page without recipe data and a failed model is a failed search', async () => {
    const { find } = finderWith({ outcome: 'none' }, { outcome: 'failed' })

    expect(await find(WITH_CAPTION)).toEqual({ outcome: 'failed' })
  })

  test('a page that can\'t be read and a Caption without a Recipe is a failed search: another try may read the page', async () => {
    const { find } = finderWith({ outcome: 'unreadable' }, { outcome: 'read', ingredients: [], steps: [] })

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
    const { find } = finderWith({ outcome: 'none' }, { outcome: 'read', ingredients, steps })

    const found = await find(WITH_CAPTION)

    expect(found).toMatchObject({ outcome: 'found', link: null })
    if (found.outcome !== 'found') return
    expect(found.recipe.ingredients).toHaveLength(60)
    expect(found.recipe.ingredients[0]).toBe('z'.repeat(200))
    expect(found.recipe.steps).toEqual(['ß'.repeat(1000), 'Fertig.'])
  })

  test('lines that are all empty after trimming are none', async () => {
    const { find } = finderWith({ outcome: 'none' }, { outcome: 'read', ingredients: [' '], steps: [''] })

    expect(await find(WITH_CAPTION)).toEqual({ outcome: 'none' })
  })
})
