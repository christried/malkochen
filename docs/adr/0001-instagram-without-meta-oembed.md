---
status: partly superseded by ADR 0005 (the Suggested Title); no Meta app still stands
---

# Instagram images come from the Reel's or post's page, not Meta oEmbed

Deviates from spec [#1](https://github.com/christried/malkochen/issues/1) (story 15, Source Lookup → Instagram, and "Environment variables").

## Context

Spec #1 had Source Lookup call Meta's `instagram_oembed` with an app access token, listed a Meta app ID and app secret as new environment variables, and expected it to degrade to "no image, no title" without a token or when Meta removed fields. Since November 2025, `instagram_oembed` has returned neither the image nor the caption, so that degraded case is the only one there is. Instagram's Reel and post pages still serve `og:image` to a server without a login; the caption on those pages is always `null`.

## Decision

There is no Meta app and no token. Source Lookup for Instagram resolves Instagram's `/share/` links to the Reel or post, loads its page and takes its `og:image` (falling back to `twitter:image`). It never gives a Suggested Title, which #1 already allowed ("whenever Instagram allows it"), so Instagram Dishes are titled by hand (`CONTEXT.md` → Supported Source). See [`server/source-lookup/instagram.ts`](../../server/source-lookup/instagram.ts) and its fixtures in [`tests/source-lookup/source-lookup.test.ts`](../../tests/source-lookup/source-lookup.test.ts).

## Consequences

- No Meta app ID or app secret exists: not in `server/env.ts`, `.env.example`, the README or Vercel (checked 2026-10-01). Don't add one for Instagram unless Meta's oEmbed returns those fields again.
- If Instagram puts the page behind its login wall, the lookup finds no image and the placeholder picker opens, as for any link with nothing found. It never errors.
- Adding an Instagram Dish always means typing a title. The Add Dish sheet asks for one the same way it does for Pinterest.
