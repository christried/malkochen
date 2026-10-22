# Coding standards

What a code review of malkochen checks a change against, besides the spec it implements. Domain language lives in `CONTEXT.md`; how to run, test and deploy in `docs/development.md`.

## Changelog

The Changelog (`CONTEXT.md` → Changelog, Version) is kept in every PR, not afterwards. How to write it: `docs/agents/changelog.md`.

- A PR outside a spec that users notice adds its line under `## [Unreleased]` in `CHANGELOG.md`, `CHANGELOG.de.md` and `CHANGELOG.it.md`. A PR without one that changes what users see, feel or are protected by breaks this standard.
- A PR inside a spec adds nothing, except the spec's last ticket ("Changelog entry and Version for this spec"): it rewrites any `[Unreleased]` lines into their own patch, then writes the spec's one entry as the next patch, both dated, and sets `package.json`'s `version` to it.
- Only what users notice. A line about tests, CI, refactors, docs or dependency updates breaks this standard.
- Sections are `Added`, `Changed`, `Removed`, `Fixed` and `Security`, in English in all three files.
- Lines are in the app's tone (casual, warm, "du" and "tu"), plain sentences, no Markdown.
- All three files change together, with the same Versions and dates.
- A minor Version only with the user's yes, quoted or linked in the PR. Otherwise a patch.
