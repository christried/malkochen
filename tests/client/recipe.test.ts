import { expect, test } from 'vitest'
import { recipeAfterEdit } from '../../shared/recipe'

// Seam 4: what a Dish's Recipe is after a Member's edit, as the server stores
// it (server/utils/dishes.ts editDish): the lists replaced as a whole, the
// link it was found at kept until nothing is left of it.

const found = { ingredients: ['Mehl'], steps: ['Backen'], link: 'https://blog.example/rezept' }

test('an edit replaces both lists and keeps the link the Recipe was found at', () => {
  expect(recipeAfterEdit(found, { ingredients: ['Mehl', 'Eier'], steps: [] })).toEqual({ ingredients: ['Mehl', 'Eier'], steps: [], link: 'https://blog.example/rezept' })
})

test('a Recipe typed from nothing has no link', () => {
  expect(recipeAfterEdit(null, { ingredients: ['Mehl'], steps: [] })).toEqual({ ingredients: ['Mehl'], steps: [], link: null })
})

test('null clears the Recipe, its link with it', () => {
  expect(recipeAfterEdit(found, null)).toBeNull()
})

test('two empty lists are no Recipe', () => {
  expect(recipeAfterEdit(found, { ingredients: [], steps: [] })).toBeNull()
})
