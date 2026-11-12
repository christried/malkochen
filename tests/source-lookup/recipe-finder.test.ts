import { describe, expect, test } from 'vitest'
import { createRecipeFinder, heldToLimits } from '../../server/recipe-finder'
import type { RecipeLookup, RecipeLookupResult } from '../../server/source-lookup'

// The Recipe Finder (CONTEXT.md, #500), given a fake recipe lookup: what it
// answers for each way reading a Source's page can end, and that what it
// found is held to a Recipe's limits.

const SOURCE = { link: 'https://kochblog.example/linsensuppe', kind: 'blog', caption: null } as const

function finderWith(answer: RecipeLookupResult | (() => Promise<RecipeLookupResult>)) {
  const asked: string[] = []
  const lookupRecipe: RecipeLookup = async (link) => {
    asked.push(link)
    return typeof answer === 'function' ? answer() : answer
  }
  return { find: createRecipeFinder({ lookupRecipe }), asked }
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
