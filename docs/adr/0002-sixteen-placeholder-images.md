# 16 Placeholder Images instead of 12

Deviates from spec [#1](https://github.com/christried/malkochen/issues/1) (story 20, the Placeholder Image list and the placeholder picker).

## Context

Spec #1 named 12 Placeholder Images: Pasta, Ramen/Suppe, Curry, Buddha Bowl, Salat, Burger, Tacos, Pizza, Wok, Porridge/Frühstück, Brot, Kuchen/Dessert. The design handoff (`docs/design handoff/illustrations.json`) delivered four more in the same style: Dumplings, Eintopf, Wrap and Smoothie. With them, more Dishes found without an image get a placeholder that resembles them.

## Decision

v1 ships all 16 (#20). [`shared/placeholders.ts`](../../shared/placeholders.ts) lists their keys in picker order. Each one has a still per theme under `public/placeholders/` and an animated loop rendered by the Remotion project.

## Consequences

- A Dish stores a placeholder's key. Removing or renaming one of the 16 would leave Dishes pointing at a missing image, so the list only ever grows.
- Anything that counts the placeholders, or lays out the picker grid for a fixed number, follows `PLACEHOLDERS` rather than the spec's "12".
