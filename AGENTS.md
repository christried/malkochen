# malkochen

A shared board for collecting food found online and organising what to cook.

- Domain language: `CONTEXT.md`. Decisions: `docs/adr/`. Running, testing, deploying and Releases: `docs/development.md`.
- `staging` is the default branch: branch from it and open PRs into it. `main` changes only through a Release or a hotfix.
- A change users notice goes into all three changelogs in the same PR: `CHANGELOG.md`, `CHANGELOG.de.md`, `CHANGELOG.it.md`.
- Never start the Email Digest on Staging: its data copy holds real addresses.

## Product rules

- Android is the only phone target: no iPhone, iOS or Safari steps.
- Never the Play Store, and no TWA wrappers.
- Copy suits any group that cooks together, not only flatmates.
- Copy uses plain sentences: no dashes or middle dots as separators.
- Snackbert is never judgemental about eating: curious, warm, cheeky.
