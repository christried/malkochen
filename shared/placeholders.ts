// The Placeholder Images (CONTEXT.md): the handoff's 16 vegan dish
// illustrations, in picker order. A Dish stores one of these keys as its image;
// the stills live at /placeholders/<key>-light.svg and <key>-dark.svg.
export const PLACEHOLDERS = [
  'pasta',
  'ramen',
  'curry',
  'bowl',
  'salad',
  'burger',
  'tacos',
  'pizza',
  'wok',
  'porridge',
  'bread',
  'cake',
  'dumplings',
  'eintopf',
  'wrap',
  'smoothie',
] as const

export type Placeholder = typeof PLACEHOLDERS[number]
