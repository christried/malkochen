---
status: superseded by ADR 0004
---

# 16 Placeholder Images instead of 12

v1 shipped 16 Placeholder Images: the 12 first planned (Pasta, Ramen/Suppe, Curry, Buddha Bowl, Salat, Burger, Tacos, Pizza, Wok, Porridge/Frühstück, Brot, Kuchen/Dessert) plus four the design handoff (`docs/design handoff/illustrations.json`) delivered in the same style: Dumplings, Eintopf, Wrap and Smoothie. ADR 0004 replaced them with 12.

## Consequences that still hold

- A Dish stores a Placeholder Image's key, so removing or renaming one would leave Dishes pointing at a missing image.
- Anything that counts the Placeholder Images, or lays out the picker grid, follows `PLACEHOLDERS` in [`shared/placeholders.ts`](../../shared/placeholders.ts), not a fixed number.
