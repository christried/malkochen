// How far past a card's middle a dragged card must go before its slot moves
// over that card, so a pointer held near the boundary doesn't flip the slot
// back and forth.
export const DROP_HYSTERESIS = 24

// Where a dragged card whose middle is at `middle` goes among a Column's
// other cards, given their middles top to bottom: past every one whose middle
// it is below. From its `slot` in this Column (null coming in from
// elsewhere), it takes DROP_HYSTERESIS more to pass a card either way.
export function dropIndex(middles: readonly number[], middle: number, slot: number | null): number {
  let index = 0
  middles.forEach((cardMiddle, i) => {
    const band = slot === null ? 0 : i < slot ? -DROP_HYSTERESIS : DROP_HYSTERESIS
    if (middle > cardMiddle + band) index++
  })
  return index
}
