// The two full-screen celebrations (CelebrationDialog), each a clip drawn in
// code (public/clips/<clip>-<theme>.svg, #215).
export type CelebrationClip = 'milestone-10x' | 'board-created'

// Each clip's pebble as its drawing animates it (its layer's `data-loop`,
// keyframes in loops.css), for the label on it to pop in step.
export const CELEBRATION_PEBBLES: Record<CelebrationClip, string> = {
  'milestone-10x': 'm10-pebble 1.8s linear infinite',
  'board-created': 'bc-pebble 1.2s linear infinite',
}
