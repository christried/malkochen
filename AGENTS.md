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
