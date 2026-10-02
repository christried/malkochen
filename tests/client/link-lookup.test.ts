import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { useLinkLookup, type LookupAnswer } from '../../app/composables/useLinkLookup'

// Seam 4: the client link lookup module. A link goes in as the Member types
// or pastes it, and the tests look at its status and result, and at the
// lookups the fake Source Lookup was asked for. Each fake lookup answers only
// when the test says so.

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function answer(link: string): LookupAnswer {
  return { kind: 'blog', canonicalLink: `${link}/kanonisch`, suggestedTitle: 'Linsen-Dal', imageUrl: 'https://bilder.example/dal.jpg', imageTicket: 'ticket' }
}

function setup() {
  const asked: { link: string, answer: () => void, fail: () => void }[] = []
  const lookUp = (link: string) => new Promise<LookupAnswer>((resolve, reject) => {
    asked.push({ link, answer: () => resolve(answer(link)), fail: () => reject(new Error('Lookup failed')) })
  })
  const link = ref('')
  const lookup = useLinkLookup(link, lookUp)
  return { link, lookup, asked }
}

test('a typed link shows "looking" at once and is looked up after a pause in typing', async () => {
  const { link, lookup, asked } = setup()

  link.value = 'https://koch.example/da'
  expect(lookup.status.value).toBe('looking')
  await vi.advanceTimersByTimeAsync(200)
  link.value = 'https://koch.example/dal'
  await vi.advanceTimersByTimeAsync(200)
  expect(asked).toEqual([])

  await vi.advanceTimersByTimeAsync(100)
  expect(asked.map(a => a.link)).toEqual(['https://koch.example/dal'])

  asked[0]!.answer()
  await vi.advanceTimersByTimeAsync(0)
  expect(lookup.status.value).toBe('found')
  expect(lookup.result.value).toEqual(answer('https://koch.example/dal'))
  expect(lookup.canonicalLink.value).toBe('https://koch.example/dal/kanonisch')
})

test('a pasted link is looked up at once', () => {
  const { link, lookup, asked } = setup()

  lookup.pasted()
  link.value = 'https://koch.example/dal'

  expect(lookup.status.value).toBe('looking')
  expect(asked.map(a => a.link)).toEqual(['https://koch.example/dal'])
})

test('a slow first lookup that answers after a faster second one is ignored', async () => {
  const { link, lookup, asked } = setup()
  lookup.pasted()
  link.value = 'https://koch.example/dal'
  lookup.pasted()
  link.value = 'https://koch.example/curry'
  const [slow, fast] = asked

  fast!.answer()
  await vi.advanceTimersByTimeAsync(0)
  slow!.answer()
  await vi.advanceTimersByTimeAsync(0)

  expect(lookup.canonicalLink.value).toBe('https://koch.example/curry/kanonisch')
})

test('clearing the link returns to idle, and a lookup still under way is ignored', async () => {
  const { link, lookup, asked } = setup()
  lookup.pasted()
  link.value = 'https://koch.example/dal'

  link.value = ''
  asked[0]!.answer()
  await vi.advanceTimersByTimeAsync(0)

  expect(lookup.status.value).toBe('idle')
  expect(lookup.result.value).toBeNull()
  expect(lookup.canonicalLink.value).toBeNull()
})

test('a lookup that fails gives "failed"', async () => {
  const { link, lookup, asked } = setup()
  lookup.pasted()
  link.value = 'https://koch.example/dal'

  asked[0]!.fail()
  await vi.advanceTimersByTimeAsync(0)

  expect(lookup.status.value).toBe('failed')
  expect(lookup.result.value).toBeNull()
})
