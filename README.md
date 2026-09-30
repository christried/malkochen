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
| `DATABASE_URL` | Postgres connection string. Neon in deployed environments (neon-http driver); a `localhost` URL switches to node-postgres (`server/db/index.ts`). | `.env` locally; Vercel **production, preview and development**, each with its own Neon database or branch. |
| `BETTER_AUTH_SECRET` | Signs session cookies. At least 32 random characters. | `.env` locally; Vercel **production, preview and development**, a different value each. |
| `BETTER_AUTH_URL` | The app's public origin. Google redirects to `<this>/api/auth/callback/google`, which must be an authorised redirect URI of the Google OAuth client. | `.env` locally (`http://localhost:3000`); Vercel **production, preview and development**, each with its own origin. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client for sign-in. | `.env` locally; Vercel **production, preview and development**. |
| `ALLOWLIST_EMAILS` | The Allowlist: comma-separated emails allowed to sign in at all. | `.env` locally; Vercel **production, preview and development**. |
| `AUTH_DEV_BYPASS` | `1` enables `POST /api/auth/dev/sign-in` (below). The server refuses to start with it on Vercel production or preview. | `.env` locally, optional. The test runners set it themselves. **Never** in Vercel. |
| `VERCEL_ENV` | Set by Vercel itself; `server/env.ts` reads it only to refuse `AUTH_DEV_BYPASS` in production and preview. | Never set by hand. |
| `TEST_DATABASE_ADMIN_URL` | Superuser URL of the **local** Postgres. `pnpm test` and `pnpm test:e2e` use it to create and drop a throwaway database per run. | `.env` locally; `env:` of `.github/workflows/ci.yml` (points at the job's Postgres service, no secret). Never in Vercel. |

The test runners (`tests/api/global-setup.ts`, `tests/e2e/run.ts`) override
all auth variables with fixed test values (`tests/support/test-auth-env.ts`),
so CI needs no auth secrets.

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
pnpm test       # Vitest: builds the app, boots it on a throwaway local database, runs tests/api
pnpm test:e2e   # Playwright: dev server on a throwaway local database, runs tests/e2e
pnpm typecheck
pnpm lint
```

CI (`.github/workflows/ci.yml`) runs all four on every PR and push to `main`,
against a Postgres service container.

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
`drizzle-kit migrate`, whose WebSocket transport fails in plain Node). To
migrate a deployed database, run it with that environment's `DATABASE_URL`.

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
- Public assets: `public/icons/` (app icons and manifest) and
  `public/placeholders/<dish>-{light,dark}.svg` (Placeholder Image stills).
