// Whether the view switch can show its icons: they go, in every segment at
// once, as soon as one segment's label with its icon is wider than the room
// of its third of the track. A long word in a locale keeps its room that way.
export function iconsFit(segments: { content: number, room: number }[]): boolean {
  return segments.every(segment => segment.content <= segment.room)
}
