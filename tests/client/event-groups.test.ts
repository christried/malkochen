import { expect, test } from 'vitest'
import { EVENT_GROUPS } from '../../shared/admin'
import { EVENT_KINDS } from '../../shared/event-kinds'

// The Admin Page's Event Log filters by groups of kinds (#400): every kind
// of the event log is in exactly one, so none is unreachable by the filter.

test('every kind of event is in exactly one group', () => {
  const grouped = Object.values(EVENT_GROUPS).flat()
  expect([...grouped].sort()).toEqual([...EVENT_KINDS].sort())
  expect(new Set(grouped).size).toBe(grouped.length)
})

test('no group is empty', () => {
  for (const kinds of Object.values(EVENT_GROUPS)) expect(kinds.length).toBeGreaterThan(0)
})
