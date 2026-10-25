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

### Branches

`staging` is the default branch. Branch from it and open PRs into it. `main` changes only through a Release or a hotfix. How each flows: `docs/development.md`.

### Changelog

Every change users notice goes into the Changelog (`CHANGELOG.md`, `CHANGELOG.de.md`, `CHANGELOG.it.md`, all three in the same PR). How to write it: `docs/agents/changelog.md`. The code review checks it (`CODING_STANDARDS.md`).

- Only what users notice, under Added, Changed, Removed, Fixed or Security, in the app's tone. Never tests, CI, refactors, docs or dependency updates.
- A PR outside a spec that users notice adds its line under `[Unreleased]`.
- A spec's last ticket ("Changelog entry for this spec") writes the spec's one entry under `[Unreleased]`, with no Version and no date. A spec nobody notices gets no such ticket.
- A Release dates everything under `[Unreleased]` as one Version: a patch, or a minor only after the Operator's yes. The Operator says "Release"; the flow is in `docs/development.md`.
- `/to-tickets` on a spec adds "Changelog entry for this spec" as the spec's last ticket, blocked by all its other tickets.
