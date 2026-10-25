import { expect, test } from 'vitest'

// CI probe for #417: fails on purpose, so the PR can't be merged. Never lands.
test('fails on purpose', () => {
  expect(1).toBe(2)
})
