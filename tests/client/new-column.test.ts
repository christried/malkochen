import { expect, test } from 'vitest'
import { useNewColumn } from '../../app/composables/useNewColumn'

// The rules for naming a new Column, shared by Board settings and the
// Board's add lane: the name is trimmed, an empty one can't be added, and
// one add at a time.

function setup(add: (name: string) => Promise<unknown> = () => Promise.resolve()) {
  const added: string[] = []
  let failures = 0
  const column = useNewColumn(async (name) => {
    added.push(name)
    await add(name)
  }, () => failures++)
  return { column, added, failures: () => failures }
}

test('a name is added trimmed, and the field is emptied once it is', async () => {
  const { column, added } = setup()
  column.name.value = '  Wochenende  '

  expect(await column.submit()).toBe(true)

  expect(added).toEqual(['Wochenende'])
  expect(column.name.value).toBe('')
})

test('an empty or blank name can’t be added', async () => {
  const { column, added } = setup()
  expect(column.canAdd.value).toBe(false)
  column.name.value = '   '
  expect(column.canAdd.value).toBe(false)

  expect(await column.submit()).toBe(false)

  expect(added).toEqual([])
})

test('while one is being added, another can’t be', async () => {
  let finish = () => {}
  const { column, added } = setup(() => new Promise<void>(resolve => (finish = resolve)))
  column.name.value = 'Wochenende'
  const first = column.submit()
  expect(column.adding.value).toBe(true)
  expect(column.canAdd.value).toBe(false)

  expect(await column.submit()).toBe(false)
  finish()
  expect(await first).toBe(true)

  expect(added).toEqual(['Wochenende'])
  expect(column.adding.value).toBe(false)
})

test('an add that fails keeps the name and says so', async () => {
  const { column, failures } = setup(() => Promise.reject(new Error('offline')))
  column.name.value = 'Wochenende'

  expect(await column.submit()).toBe(false)

  expect(failures()).toBe(1)
  expect(column.name.value).toBe('Wochenende')
  expect(column.adding.value).toBe(false)
})
