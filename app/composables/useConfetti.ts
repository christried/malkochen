// The Gekocht celebration's veggie confetti, set off where the Cooking
// starts (the "Gekocht ✓" button, where a Dish was dropped) the moment it
// starts, ahead of the toast. Shared, as it shows wherever VeggieConfetti
// is: over the Board, or in the Dish detail (the Board is inert behind it).
export function useConfetti() {
  const burst = useState<{ origin: Point, key: number } | null>('confetti', () => null)
  return {
    burst,
    fire: (origin: Point) => {
      burst.value = { origin, key: (burst.value?.key ?? 0) + 1 }
    },
    clear: () => {
      burst.value = null
    },
  }
}
