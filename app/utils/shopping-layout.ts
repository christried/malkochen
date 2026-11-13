// The Shopping List's layout (#536), as pure functions the screen calls.

// The desktop column of each Dish group, in list order: each goes into the
// shorter of the two columns, a tie to the left. `gap` is the space a group
// takes below itself, so the columns are compared as they will look.
export function masonryColumns(heights: readonly number[], gap = 0): (0 | 1)[] {
  const sums: [number, number] = [0, 0]
  return heights.map((height) => {
    const column = sums[1] < sums[0] ? 1 : 0
    sums[column] += height + gap
    return column
  })
}
