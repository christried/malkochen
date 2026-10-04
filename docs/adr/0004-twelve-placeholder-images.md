---
status: accepted (supersedes ADR 0002)
---

# 12 Placeholder Images, and Dishes moved off the removed ones

The desktop review (`docs/reviews/desktop-review1.md`) found the 16 Placeholder Images of ADR 0002 not good enough. We keep the nine that work (ramen, burger, tacos, wok, bread, cake, smoothie, eintopf, dumplings) and add three drawn fresh by Claude Design (Pasta, Salat/Bowl, Frühstück), for 12 in all.

A Dish stores a Placeholder Image's key, so the seven removed keys can't just disappear. A one-time migration moves every Dish on a removed key to the closest one left:

| Removed | Becomes |
|---|---|
| pasta | Pasta (new) |
| salad, bowl | Salat/Bowl (new) |
| porridge | Frühstück (new) |
| curry | eintopf |
| wrap | tacos |
| pizza | bread |

## Considered Options

- Keep the removed files as hidden legacy images: every removed image would still need its stills and loops for both themes, forever, for Dishes nobody can pick them for.
- A fallback image for unknown keys: Dishes would silently lose an image their Member picked on purpose.
