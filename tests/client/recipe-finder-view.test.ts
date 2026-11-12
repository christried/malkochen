import { expect, test } from 'vitest'
import { finderShown, type FinderInput } from '../../app/board/recipe-finder-view'

// What the Dish detail shows where a Recipe would be (#504). The base is a
// Recipe Finder user who may edit a Dish with a Source and no Recipe.
const base: FinderInput = { hasRecipe: false, hasSource: true, search: null, note: null, finderOn: true, mayEdit: true }
const shown = (changes: Partial<FinderInput> = {}) => finderShown({ ...base, ...changes })

test('"Rezept finden" shows beside "Rezept hinzufügen" to a Recipe Finder user who may edit a Dish with a Source and no Recipe', () => {
  expect(shown()).toEqual({ view: 'action', find: true, add: true })
})

test('without the Recipe Finder, or when the server cannot search, only "Rezept hinzufügen" shows', () => {
  expect(shown({ finderOn: false })).toEqual({ view: 'add', find: false, add: true })
})

test('without a Source there is nothing to search for', () => {
  expect(shown({ hasSource: false })).toEqual({ view: 'add', find: false, add: true })
})

test('a Member who may not edit sees nothing, not even a gap', () => {
  expect(shown({ mayEdit: false })).toEqual({ view: 'nothing', find: false, add: false })
})

test('a Dish with a Recipe shows no finder at all', () => {
  expect(shown({ hasRecipe: true, search: 'none' })).toEqual({ view: 'nothing', find: false, add: false })
})

test('while a search runs every Member sees it, and "Rezept hinzufügen" is hidden', () => {
  expect(shown({ search: 'looking' })).toEqual({ view: 'searching', find: false, add: false })
  expect(shown({ search: 'looking', mayEdit: false, finderOn: false })).toEqual({ view: 'searching', find: false, add: false })
})

test('after nothing was found every Member is told, and "Rezept finden" is gone', () => {
  expect(shown({ search: 'none' })).toEqual({ view: 'none', find: false, add: true })
  expect(shown({ search: 'none', mayEdit: false, finderOn: false })).toEqual({ view: 'none', find: false, add: false })
})

test('after a search that failed, "Noch mal suchen" is offered with "Rezept hinzufügen"', () => {
  expect(shown({ note: 'failed' })).toEqual({ view: 'failed', find: true, add: true })
})

test('"Noch mal suchen" goes when the Recipe Finder was switched off meanwhile', () => {
  expect(shown({ note: 'failed', finderOn: false })).toEqual({ view: 'failed', find: false, add: true })
})

test('at the day’s cap there is a note and "Rezept hinzufügen", but no search', () => {
  expect(shown({ note: 'quota' })).toEqual({ view: 'quota', find: false, add: true })
})

test('a search by someone else running wins over this user’s old note', () => {
  expect(shown({ note: 'quota', search: 'looking' })).toMatchObject({ view: 'searching' })
})
