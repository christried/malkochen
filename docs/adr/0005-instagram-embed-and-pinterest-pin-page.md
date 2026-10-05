---
status: accepted (supersedes ADR 0001's "never a Suggested Title")
---

# Instagram from its embed page, Pinterest titles from the Pin page

ADR 0001 concluded that Instagram never gives a caption, because the Reel or post page a server sees without a login has `"caption":null`. Instagram's embed page for the same post (`/reel/<code>/embed/captioned/`, `/p/<code>/embed/captioned/`) does show it, together with the account that posted it and the cover image without the play button that `og:image` carries, at twice the size (checked 2026-10-04: 720×1280 against 360×640). Source Lookup reads the embed page first and falls back to the post page's `og:image` when it fails.

Pinterest's oEmbed title is unusable (usually the literal "oEmbed"), but the Pin page's `og:title` is "<Pin title> | <board keywords>". The part before the first ` | ` becomes the Suggested Title. A Pin without a title of its own gets an `og:title` made up from its board ("Pin auf <board>"), which is no Suggested Title. The Creator is the person who pinned it, as oEmbed's `author_name` names them (a profile tagline after ` | ` left out), not the original site: that is often only a short link (`l8r.it`), and for food Pins the pinner is usually the blog itself.

## Consequences

- The embed page isn't an official interface, so Instagram can change it without notice. When it does, the lookup quietly falls back to the post page: an image, no title, exactly as before. It never errors.
- Still no Meta app and no token (ADR 0001 stands on that).
- The title stays required whenever no Suggested Title comes back, so a broken lookup costs typing, nothing more.
