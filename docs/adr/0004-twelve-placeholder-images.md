---
status: accepted (supersedes ADR 0002)
---

# 12 Placeholder Images, and Dishes moved off the removed ones

Of the 16 Placeholder Images of ADR 0002, nine stay (ramen, burger, tacos, wok, bread, cake, smoothie, eintopf, dumplings) and three are drawn fresh by Claude Design: Pasta and Salat/Bowl under the existing keys `pasta` and `bowl`, and Frühstück under the new key `breakfast`, for 12 in all.

A Dish stores a Placeholder Image's key. Dishes on `pasta` and `bowl` simply get the new drawings. A one-time migration moves every Dish on one of the five removed keys to the closest key left, as the handoff's `illustrations.json → migration` lists it:

| Removed | Becomes |
|---|---|
| curry, salad | bowl |
| porridge | breakfast |
| wrap | tacos |
| pizza | bread |

Curry goes to `bowl`, not `eintopf`, because the auto-pick's keywords also send "curry", "dal" and "chili" to `bowl`: an old curry Dish and a new one end up with the same image.

## Considered Options

- Keep the removed files as hidden legacy images: every removed image would still need its stills and loops for both themes, forever, for Dishes nobody can pick them for.
- A fallback image for unknown keys: Dishes would silently lose an image their Member picked on purpose.
