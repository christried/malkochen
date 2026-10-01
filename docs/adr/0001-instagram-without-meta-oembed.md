# Instagram images come from the post page, not Meta oEmbed

Deviates from spec [#1](https://github.com/christried/malkochen/issues/1) (Source Lookup → Instagram, and "Environment variables").

## Context

Spec #1 had Source Lookup call Meta's `instagram_oembed` with an app access token for an Instagram Reel's or post's image and caption. It also listed a Meta app ID and app secret as new environment variables. Since November 2025, `instagram_oembed` has returned neither the image nor the caption. Instagram's post page still serves `og:image` to a server without a login. Its caption is always `null`.

## Decision

Source Lookup for Instagram resolves share links to the post, loads the post page and takes its `og:image` (falling back to `twitter:image`). It never calls Meta and never gives a Suggested Title, so Instagram Dishes are titled by hand (`CONTEXT.md` → Supported Source). See [`server/source-lookup/instagram.ts`](../../server/source-lookup/instagram.ts) and its fixtures in [`tests/source-lookup/source-lookup.test.ts`](../../tests/source-lookup/source-lookup.test.ts).

## Consequences

- No Meta app, app ID or app secret exists. None is in `server/env.ts`, `.env.example`, the README or Vercel (checked 2026-10-01). Don't add one for Instagram unless Meta's oEmbed returns those fields again.
- If Instagram puts the post page behind its login wall, the lookup finds no image and the placeholder picker opens, as for any link with nothing found. It never errors.
- Adding an Instagram Dish always means typing a title. The Add Dish sheet asks for one the same way it does for Pinterest.
