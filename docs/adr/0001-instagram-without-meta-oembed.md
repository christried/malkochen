---
status: partly superseded by ADR 0005 (the Suggested Title); no Meta app still stands
---

# Instagram images come from the Reel's or post's page, not Meta oEmbed

## Context

Since November 2025, Meta's `instagram_oembed` returns neither the image nor the caption, even with an app access token. Instagram's Reel and post pages still serve `og:image` to a server without a login.

## Decision

There is no Meta app and no token. Source Lookup for Instagram resolves Instagram's `/share/` links to the Reel or post, loads its page and takes its `og:image` (falling back to `twitter:image`). See [`server/source-lookup/instagram.ts`](../../server/source-lookup/instagram.ts) and its fixtures in [`tests/source-lookup/source-lookup.test.ts`](../../tests/source-lookup/source-lookup.test.ts). (This ADR's "never a Suggested Title" is superseded by ADR 0005.)

## Consequences

- No Meta app ID or app secret exists: not in `server/env.ts`, `.env.example`, the README or Vercel. Don't add one for Instagram unless Meta's oEmbed returns those fields again.
- If Instagram puts the page behind its login wall, the lookup finds no image and the placeholder picker opens, as for any link with nothing found. It never errors.
