# malkochen

A shared board for collecting food found online (TikTok, Instagram, YouTube Shorts, Pinterest, food blogs) and organising what to cook. Domain language lives in `CONTEXT.md`.

## Agent skills

### Issue tracker

Issues and specs live in this repo's GitHub Issues (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Implementation order

When asked to implement without a ticket number (e.g. a bare `/implement`, or "next ticket"), pick the next ticket from `docs/agents/implementation-order.md`. Follow its order, not just the issues' blocking edges.

### Changelog

Every change users notice goes into the Changelog (`CHANGELOG.md`, `CHANGELOG.de.md`, `CHANGELOG.it.md`, all three in the same PR). How to write it: `docs/agents/changelog.md`. The code review checks it (`CODING_STANDARDS.md`).

- Only what users notice, under Added, Changed, Removed, Fixed or Security, in the app's tone. Never tests, CI, refactors or docs.
- A spec's last ticket writes the spec's one entry and dates its Version, a patch. Any lines under `[Unreleased]` are first rewritten into a patch of their own, just before it.
- A PR outside a spec that users notice adds its line under `[Unreleased]`.
- A minor Version only after asking the user and getting their yes; otherwise always a patch.
- `/to-tickets` on a spec adds "Changelog entry and Version for this spec" as the spec's last ticket, blocked by all its other tickets.
