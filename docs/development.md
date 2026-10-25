# Development

How to run, test and deploy malkochen. Domain language lives in [`CONTEXT.md`](../CONTEXT.md); the design handoff in [`docs/design handoff/`](design%20handoff/README.md).

## Where the app runs

malkochen runs in three places. Each has its own database, images, accounts and Push keys, and a change reaches them in this order: local, Staging, production.

- **Local**: `pnpm dev` on your PC, against a local Postgres. The test suites run here before a PR, and again in CI.
- **Staging**: the Operator's copy at `https://staging.malkochen.christried.me`, deployed from the `staging` branch. Its database is a copy of production's data, so its writes stay in that copy. It is behind the Vercel login: the agent reaches it through the Vercel MCP (`web_fetch_vercel_url`) or a Chrome that is signed in to Vercel, and a phone signs in to Vercel in Chrome first. Staging installs as "malkochen Staging", and every page shows a small "Staging" label.
- **Production**: deployed from `main`. Users only get what a Release has brought there.

## Working a ticket, a Release and a hotfix

**A ticket.** Branch from `staging`, the default branch, and open a PR into `staging` with `Closes #n`. Merge it with a merge commit once CI is green. No approval is needed, and nobody bypasses the rules. Then check that the Staging deploy is READY with its migration applied (the build log says "Migrations applied."), and try the change in Chrome on Staging, signed in as the Operator. Device checks (`ready-for-human`) happen on Staging, on the phone. A merged ticket is Staged: it is on Staging, not yet in production.

**A Release**, when the Operator says "Release":

1. A PR into `staging` turns everything under `## [Unreleased]` into one dated Version in all three Changelog files: the newest Version plus one (a minor only after the Operator's yes), with the link references and `package.json`'s `version`. Merged on green CI, Staging shows the new Version and its Changelog Popup.
2. A PR `staging` → `main` titled "Release x.y.z", merged on green CI with a merge commit, straight after step 1.
3. Tag the merge commit on `main` as `vx.y.z` and push the tag. Check that the production deploy is READY with its migration applied, then smoke-test production.

**A hotfix**, a fix that can't wait for a Release: branch from `main` and open a PR into `main` that carries its own dated patch Version, as the Release's first step does. Merge it, tag it and check production the same way. The same day, open a PR `main` → `staging`, so Staging has what production has. Its Changelog files may conflict: keep the lines under `[Unreleased]` above the hotfix's Version.

**Staging's daily jobs.** Vercel runs crons in production only. Staging's cleanup (`/api/cron/cleanup`) can be started by hand with Staging's `CRON_SECRET` as a bearer token, with the same Vercel access any other check there needs. Never start the Email Digest (`/api/cron/email-digest`) on Staging: its copy holds real addresses, so it would mail real users.

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
| `DATABASE_URL` | Postgres connection string. Neon in deployed environments (neon-http driver); a `localhost` URL switches to node-postgres (`server/db/index.ts`). | `.env` locally; Vercel **production and development**, each with its own Neon database or branch. Staging: its own Neon database, holding a copy of production's data. |
| `BETTER_AUTH_SECRET` | Signs session cookies. At least 32 random characters. | `.env` locally; Vercel **production and development**, a different value each. Staging: a value of its own. |
| `BETTER_AUTH_URL` | The app's public origin. Google redirects to `<this>/api/auth/callback/google`, which must be an authorised redirect URI of the Google OAuth client. | `.env` locally (`http://localhost:3000`); Vercel **production and development**, each with its own origin. Staging: `https://staging.malkochen.christried.me`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client for sign-in. | `.env` locally; Vercel **production and development**. Staging: production's OAuth client, with Staging's callback added as a redirect URI. |
| `ALLOWLIST_EMAILS` | The Allowlist: comma-separated emails allowed to sign in at all. | `.env` locally; Vercel **production and development**. Staging: only the Operator's address, plus a Gmail plus-alias for each further Member a test needs, added when a test needs one. |
| `OPERATOR_EMAIL` | The Operator (`CONTEXT.md`): the one email address the Admin Page (`/admin`, `GET /api/admin`) is for. Everyone else gets "not found" there and no Admin link in Your Settings. Empty: nobody has it. | Vercel **production** and Staging (the Operator's own address). Optional in `.env`. The test runners set their own. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token: the Image Store copies each Dish's Source image there on save, and keeps Members' own photos ("Eigenes Foto") there. Required in Vercel production and preview (the server refuses to start without it). Empty locally stores images on disk under `.data/images`, served at `/images/…`. | Vercel **production and development**, set by connecting the project's Blob store. Staging: a store of its own, `malkochen-images-staging`, connected to Preview on `staging`; production's store is on Production only. Optional in `.env`. Never in CI (tests store on disk). |
| `IMAGE_DIR` | Where images are stored on disk without a Blob token. Defaults to `.data/images`. | Optional in `.env`. The API tests set their own (`tests/api/server-env.ts`), so their cleanup job never touches local dev's images. Never in Vercel. |
| `CRON_SECRET` | Vercel Cron sends it as a bearer token to the daily jobs (the cleanup, `/api/cron/cleanup`, and the Email Digest, `/api/cron/email-digest`, both scheduled in `vercel.json`), which refuse every request without it. At least 16 random characters. Empty: the jobs never run. | Vercel **production** and Staging, a value each. Vercel runs crons in production only, so Staging's jobs are started by hand (see "Working a ticket, a Release and a hotfix"). The API tests set their own. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Push notifications: the VAPID key pair the server signs its pushes with (base64url, as `npx web-push generate-vapid-keys` prints them) and a contact for the push services (`mailto:you@example.com` or an `https:` URL). The public key also reaches the browser, which subscribes with it (`runtimeConfig.public.vapidPublicKey`, read at build time). All three or none: without them the settings offer no push notifications. With `AUTH_DEV_BYPASS=1` a subscription may point at any push service, so the tests can stand one in. | Vercel **production and development**, the same key pair in both or one each; a new key pair makes every device turn push on again. Staging: a key pair of its own. The copy's subscriptions were made with production's keys, so only subscriptions made on Staging get Staging's pushes. Optional in `.env`. The test runners set test keys themselves. |
| `RESEND_API_KEY` | The Email Digest: the [Resend](https://resend.com) API key the daily email (`/api/cron/email-digest`, 16:00 UTC in `vercel.json`) is sent with, from `malkochen@christried.me` (christried.me must be a verified sending domain at Resend). Whether it is set also reaches the browser (`runtimeConfig.public.emailDigest`, read at build time); the key itself never does. Also sends the sign-in code for email sign-in (#345; `runtimeConfig.public.emailSignIn`). Empty: the settings offer no digest, the sign-in page offers Google only, and nothing is sent. | Vercel **production and development**. Staging: a key of its own, from the same sending domain. Never run the Email Digest on Staging by hand: its copy holds real addresses. Optional in `.env`. The test runners set a dummy key and send to a stand-in. |
| `RESEND_BASE_URL` | Where Resend's API is instead of `https://api.resend.com`: the test runners point it at a stand-in (`tests/support/resend-service.ts`) that keeps what is sent. The server refuses to start with it on Vercel production or preview. | Tests only. **Never** in Vercel. |
| `MALKOCHEN_VERSION` | The Version the server runs as (`server/version.ts`) in place of `package.json`'s, so the tests see the same one whatever the newest Version is. The server refuses to start with it on Vercel production or preview. | Tests only: the test runners set it themselves. **Never** in Vercel. |
| `AUTH_DEV_BYPASS` | `1` enables `POST /api/auth/dev/sign-in` (below). The server refuses to start with it on Vercel production or preview. | `.env` locally, optional. The test runners set it themselves. **Never** in Vercel. |
| `VERCEL_ENV` | Set by Vercel itself; `server/env.ts` reads it only to refuse `AUTH_DEV_BYPASS` and require `BLOB_READ_WRITE_TOKEN` in production and preview. | Never set by hand. |
| `TEST_DATABASE_ADMIN_URL` | Superuser URL of the **local** Postgres. `pnpm test` and `pnpm test:e2e` use it to create and drop a throwaway database per run. | `.env` locally; `env:` of `.github/workflows/ci.yml` (points at the job's Postgres service, no secret). Never in Vercel. |

Staging's variables are set for Preview, on the branch `staging`. Never set there: `AUTH_DEV_BYPASS`, `RESEND_BASE_URL` and `MALKOCHEN_VERSION` (the server refuses to start with them on Preview anyway).

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

CI (`.github/workflows/ci.yml`) runs on every PR, into `staging` and into `main`, on GitHub-hosted runners against a Postgres service container. Its check **CI** is the one the rulesets require. A PR that changes only docs and Markdown skips lint, typecheck, Vitest and the browser tests, and CI still reports at once. Otherwise: lint, typecheck and Vitest in one job, the browser tests in eight shards beside it. The merge itself starts no second run.
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

Vercel deploys two branches: `main` (production) and `staging` (Staging, the Preview environment scoped to that branch). `vercel.json` turns off deployments for every other branch. Test changes locally, then on Staging after the merge into `staging`, then on production after the Release.

Every Vercel build, production's and Staging's, runs `pnpm db:migrate` before `pnpm build`, against that environment's `DATABASE_URL`, so a migration reaches Staging's copy before its build. A failing migration fails the build, so the old deployment stays
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
- UI text: all of it lives in `app/strings/`, German (`de.ts`, the source),
  English (`en.ts`) and Italian (`it.ts`), each of the type `Strings`, so a
  missing key fails the type check. Components read the current language's
  through `useStrings()`: the user's choice under Sprache, else the browser's
  languages
  (`shared/language.ts`; Accept-Language on the server, so the first render
  is already right). Counts, plurals and dates go through `Intl`
  (`app/strings/intl.ts`). The browser tests run in a German browser
  (`locale: 'de-DE'` in `playwright.config.ts`).
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
separate Remotion project in [`remotion/`](../remotion/README.md), outside the
pnpm workspace, renders none of them any more; its Studio still shows the
scenes the drawings were timed from:

```bash
cd remotion
npm install
npm run dev      # Remotion Studio, to check the scenes by eye
```
