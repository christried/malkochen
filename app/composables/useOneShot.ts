// A one-off effect that may be set off again while it still shows (a burst,
// a flight, a label flip): `shot` holds what it shows and a key that changes
// every time, for the effect's element to be keyed by, so it starts over.
export function useOneShot<T>() {
  const shot = shallowRef<{ value: T, key: number } | null>(null)
  let count = 0
  return {
    shot,
    fire: (value: T) => {
      shot.value = { value, key: ++count }
    },
    clear: () => {
      shot.value = null
    },
  }
}
