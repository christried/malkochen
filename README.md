# malkochen

A shared board for collecting food found online (TikTok, Instagram, YouTube
Shorts, Pinterest, food blogs) and organising what to cook. Domain language
lives in [`CONTEXT.md`](CONTEXT.md); the design handoff in
[`docs/design handoff/`](docs/design%20handoff/README.md).

Nuxt 4 (Vue 3, TypeScript) · Tailwind CSS v4 with the handoff's preset ·
Neon Postgres + Drizzle · Vitest and Playwright · hosted on Vercel.

## Local setup

Prerequisites: Node 24, pnpm, and a local PostgreSQL 14+ (tests always run
against it; on Windows: `winget install PostgreSQL.PostgreSQL.17`).

```bash
pnpm install
cp .env.example .env
# fill in .env — see "Environment variables" below
pnpm db:migrate   # apply the committed migrations to DATABASE_URL
pnpm dev          # http://localhost:3000
```

## Environment variables

All variables live in `.env.example`; copy it to `.env` for local dev. Runtime
variables are validated at startup by `server/env.ts` — add new ones there too.

| Variable | Purpose | Where it is set |
|---|---|---|
| `DATABASE_URL` | Postgres connection string. Neon in deployed environments (neon-http driver); a `localhost` URL switches to node-postgres (`server/db/index.ts`). | `.env` locally; Vercel **production and development**, each with its own Neon database or branch. |
| `BETTER_AUTH_SECRET` | Signs session cookies. At least 32 random characters. | `.env` locally; Vercel **production and development**, a different value each. |
| `BETTER_AUTH_URL` | The app's public origin. Google redirects to `<this>/api/auth/callback/google`, which must be an authorised redirect URI of the Google OAuth client. | `.env` locally (`http://localhost:3000`); Vercel **production and development**, each with its own origin. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client for sign-in. | `.env` locally; Vercel **production and development**. |
| `ALLOWLIST_EMAILS` | The Allowlist: comma-separated emails allowed to sign in at all. | `.env` locally; Vercel **production and development**. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token: the Image Store copies each Dish's Source image there on save, and keeps Members' own photos ("Eigenes Foto") there. Required in Vercel production and preview (the server refuses to start without it). Empty locally stores images on disk under `.data/images`, served at `/images/…`. | Vercel **production and development**, set by connecting the project's Blob store. Optional in `.env`. Never in CI (tests store on disk). |
| `IMAGE_DIR` | Where images are stored on disk without a Blob token. Defaults to `.data/images`. | Optional in `.env`. The API tests set their own (`tests/api/server-env.ts`), so their cleanup job never touches local dev's images. Never in Vercel. |
| `CRON_SECRET` | Vercel Cron sends it as a bearer token to the daily jobs (the cleanup, `/api/cron/cleanup`, and the Email Digest, `/api/cron/email-digest`, both scheduled in `vercel.json`), which refuse every request without it. At least 16 random characters. Empty: the jobs never run. | Vercel **production** only. The API tests set their own. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Push notifications: the VAPID key pair the server signs its pushes with (base64url, as `npx web-push generate-vapid-keys` prints them) and a contact for the push services (`mailto:you@example.com` or an `https:` URL). The public key also reaches the browser, which subscribes with it (`runtimeConfig.public.vapidPublicKey`, read at build time). All three or none: without them the settings offer no push notifications. With `AUTH_DEV_BYPASS=1` a subscription may point at any push service, so the tests can stand one in. | Vercel **production and development**, the same key pair in both or one each; a new key pair makes every device turn push on again. Optional in `.env`. The test runners set test keys themselves. |
| `RESEND_API_KEY` | The Email Digest: the [Resend](https://resend.com) API key the daily email (`/api/cron/email-digest`, 16:00 UTC in `vercel.json`) is sent with, from `malkochen@christried.me` (christried.me must be a verified sending domain at Resend). Whether it is set also reaches the browser (`runtimeConfig.public.emailDigest`, read at build time); the key itself never does. Empty: the settings offer no digest and nothing is sent. | Vercel **production and development**. Optional in `.env`. The test runners set a dummy key and send to a stand-in. |
| `RESEND_BASE_URL` | Where Resend's API is instead of `https://api.resend.com`: the test runners point it at a stand-in (`tests/api/resend-service.ts`) that keeps what is sent. The server refuses to start with it on Vercel production or preview. | Tests only. **Never** in Vercel. |
| `AUTH_DEV_BYPASS` | `1` enables `POST /api/auth/dev/sign-in` (below). The server refuses to start with it on Vercel production or preview. | `.env` locally, optional. The test runners set it themselves. **Never** in Vercel. |
| `VERCEL_ENV` | Set by Vercel itself; `server/env.ts` reads it only to refuse `AUTH_DEV_BYPASS` and require `BLOB_READ_WRITE_TOKEN` in production and preview. | Never set by hand. |
| `TEST_DATABASE_ADMIN_URL` | Superuser URL of the **local** Postgres. `pnpm test` and `pnpm test:e2e` use it to create and drop a throwaway database per run. | `.env` locally; `env:` of `.github/workflows/ci.yml` (points at the job's Postgres service, no secret). Never in Vercel. |

The test runners (`tests/api/global-setup.ts`, `tests/e2e/run.ts`) override
all auth variables, the VAPID keys and the Resend key with fixed test values
(`tests/support/test-auth-env.ts`), so CI needs no secrets.

### Signing in locally without Google

With `AUTH_DEV_BYPASS=1`, sign in as any Allowlisted email from the browser
console on `http://localhost:3000`:

```js
await fetch('/api/auth/dev/sign-in', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'you@example.com' }) })
```

It runs the same Allowlist check and creates the same kind of session as a
Google sign-in; only the trip to Google is skipped.

## Tests

```bash
pnpm test       # Vitest: tests/api (builds the app, boots it on a throwaway local database)
                #   tests/source-lookup (Source Lookup against recorded upstream fixtures, no network)
                #   tests/image-store (Image Store against a faked upstream and storage)
                #   tests/push (push messages and sending against a faked push service)
                #   and tests/email (the Email Digest and sending it against a faked Resend)
pnpm test:e2e   # Playwright: dev server on a throwaway local database, runs tests/e2e
pnpm typecheck
pnpm lint
```

CI (`.github/workflows/ci.yml`) runs all four on every PR (not on the merge to
`main`), on GitHub-hosted runners against a Postgres service container: lint,
typecheck and Vitest in one job, the browser tests in four shards beside it.
A browser test whose first try fails leaves a Playwright trace in
`test-results/`, even if the retry passes; CI uploads them as the
`e2e-traces-<shard>` artifact (14 days). Open one with
`pnpm exec playwright show-trace <trace.zip>`.

Both suites create a `malkochen_test_*` database from `TEST_DATABASE_ADMIN_URL`,
apply the migrations, and drop it afterwards; leftovers of killed runs are
swept on the next run. Nothing ever runs against Neon. First time only:
`pnpm exec playwright install chromium`.

## Database migrations

Schema lives in `server/db/schema.ts`. After changing it:

```bash
pnpm db:generate   # writes a new SQL migration under server/db/migrations
pnpm db:migrate    # applies pending migrations to DATABASE_URL
```

`db:migrate` uses the same neon-http driver as the app for Neon URLs (not
`drizzle-kit migrate`, whose WebSocket transport fails in plain Node).

Vercel deploys `main` only: `vercel.json` turns off preview deployments for
every other branch, and Vercel preview has no `DATABASE_URL`. Test changes
locally, then on production after the merge.

The production database migrates itself: `vercel.json` makes every Vercel
build run `pnpm db:migrate` before `pnpm build`, against production's
`DATABASE_URL`. A failing migration fails the build, so the old deployment stays
live. Keep migrations additive, since the previous deployment keeps running
on the migrated schema until the new one is promoted.

## Design tokens, theme, motion and text

- `app/assets/css/tokens.css` and `tailwind.preset.cjs` are copies of the
  handoff's `tokens.css` and `tailwind.preset.js`. Utilities (`bg-bg`,
  `text-text-muted`, `rounded-card`, `duration-pop`, …) resolve to the CSS
  variables, so dark mode needs no `dark:` variants. Breakpoints are only
  `tablet:` (768px) and `desktop:` (1200px).
- Theme: `useTheme()` holds light / dark / system in a cookie; `app.vue`
  reflects it as `data-theme` on `<html>` (no attribute = system).
- Motion: use the `--dur-*` / `--ease-*` tokens (`duration-*` / `ease-*`
  utilities). Under `prefers-reduced-motion` they collapse (fades keep 200ms),
  and a global rule in `main.css` stops keyframe animations.
- UI text: all of it lives in `app/strings/de.ts`, read through `useStrings()`.
- Public assets: `public/icons/` (app icons and manifest),
  `public/placeholders/<dish>-{light,dark}.svg` (the Placeholder Images), and
  `public/clips/<clip>[-{light,dark}].svg` (the state, system and celebration
  clips, drawn in code since #217; no videos).
- Loops drawn in code (`SvgLoop.vue`): the Placeholder Images, the empty
  Column's pea (`public/clips/empty-column-<accent>-{light,dark}.svg`) and the
  sign-in's Topfbert wow (`public/clips/topfbert-wow-{light,dark}.svg`) are
  layered SVGs whose animated layers name their CSS keyframes in `data-loop`
  (`app/assets/css/loops.css`). The SVG is the still, and its frame 0. They
  run at the screen's refresh rate and stay sharp at any size, so a pure
  transform/opacity loop from the handoff (Round 11's are) belongs here, not
  in a video (#111).

## Motion graphics (Remotion)

Every clip is drawn in the app since #217: layered SVGs in `public/clips/`
played by `SvgLoop.vue`, keyframes in `app/assets/css/loops.css`. The
separate Remotion project in [`remotion/`](remotion/README.md), outside the
pnpm workspace, renders none of them any more; its Studio still shows the
scenes the drawings were timed from:

```bash
cd remotion
npm install
npm run dev      # Remotion Studio, to check the scenes by eye
```
