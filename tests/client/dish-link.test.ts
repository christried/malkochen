import { expect, test } from 'vitest'
import { dishLinkPath, dishLinkSecret } from '../../shared/dish-link'

// Dish Links (#401): /d/<title slug>-<secret>. Only the secret counts, so a
// renamed Dish keeps its link.

const SECRET = '7fk2qm9xh3tdz8wpc'

test('a Dish Link is the title’s slug, then the secret', () => {
  expect(dishLinkPath({ title: 'Käsespätzle 🧀', linkSecret: SECRET })).toBe(`/d/kaesespaetzle-${SECRET}`)
})

test('a title with no letters leaves the secret alone', () => {
  expect(dishLinkPath({ title: '🧀🧀', linkSecret: SECRET })).toBe(`/d/${SECRET}`)
})

test('only the secret at the end counts, whatever comes before it', () => {
  expect(dishLinkSecret(`kaesespaetzle-${SECRET}`)).toBe(SECRET)
  expect(dishLinkSecret(`ganz-anders-${SECRET}`)).toBe(SECRET)
  expect(dishLinkSecret(SECRET)).toBe(SECRET)
})

test('a secret typed in capitals is the same secret', () => {
  expect(dishLinkSecret(`Pasta-${SECRET.toUpperCase()}`)).toBe(SECRET)
})

test('what cannot be a secret finds none', () => {
  expect(dishLinkSecret('pasta-abc')).toBeNull()
  expect(dishLinkSecret(`pasta-${SECRET}x`)).toBeNull()
  expect(dishLinkSecret('pasta-0o1l0o1l0o1l0o1l0')).toBeNull()
  expect(dishLinkSecret('pasta')).toBeNull()
  expect(dishLinkSecret('')).toBeNull()
})
