# Writing the Changelog

How to keep the Changelog (`CONTEXT.md` → Changelog, Version) without the user having to remind anyone. The page `/changelog` ("Was ist neu") is built from three files at the repo root: `CHANGELOG.md` (English), `CHANGELOG.de.md` and `CHANGELOG.it.md`. Spec: #323.

## The rule

- **Only what users notice.** Something a person using malkochen would see, feel or be protected by. Tests, CI, refactors, docs, dependency updates and anything else nobody notices never go in.
- **Five sections, English in every file:** `### Added`, `### Changed`, `### Removed`, `### Fixed`, `### Security`. The app shows them translated. Any other section name breaks the build (`shared/changelog.ts`).
- **The app's tone.** Casual and warm, as the app's strings speak (`app/strings/`): "du" in German, "tu" in Italian. Plain sentences, no dashes or middle dots as separators, no Markdown inside a line (the page shows it as plain text). The domain words from `CONTEXT.md`: Dish, Board, Gekocht, Klassiker, and so on, in each language as the app's strings name them.
- **All three files in the same PR,** with the same Versions and dates (`tests/client/changelog.test.ts` checks it).
- **A spec's last ticket writes its one entry and dates its Version.** A spec reads as one change, not twenty PRs, so the spec's other PRs add nothing. The Version is a patch: the newest Version plus one in the last number.
- **"Gerade neu" goes first.** If there are lines under `## [Unreleased]` when a spec is closed, they are rewritten into their own patch first, dated the same day, just below the spec's. `[Unreleased]` stays, empty.
- **A PR outside a spec that users notice** adds its line under `## [Unreleased]` in the same PR. The page shows it at once as "Gerade neu"; it gets its Version with the next spec.
- **A minor Version only after asking.** If a spec's feature looks big enough for one (1.1.0 rather than 1.0.8), ask the user and wait for their yes. Without it, a patch, even the 37th.
- **The app's version follows.** `package.json`'s `version` is the newest Version in the files (the same test checks it).
- **Every spec ends with this ticket.** `/to-tickets` on a spec adds "Changelog entry and Version for this spec" as its last ticket, blocked by every other ticket of the spec.

## Closing a spec, step by step

1. Read the spec and its closed tickets. Collect what users notice, grouped by section. Leave out what nobody notices, even if it took the most work.
2. If `[Unreleased]` has lines, rewrite them into a patch of their own: the newest Version plus one, today's date. Merge duplicates, drop lines a later change made untrue, and keep each one sentence or two.
3. Write the spec's entry above it: the next patch (or the minor the user agreed to), today's date.
4. Do 2 and 3 in all three files, the same Versions and dates in each. Write each language on its own terms rather than word for word.
5. Update the link references at the bottom of each file (below).
6. Set `package.json`'s `version` to the spec's Version.
7. Run `pnpm vitest run tests/client/changelog.test.ts`.
8. After the merge, tag the merge commit on `main` with the Version (`git tag v1.0.2 <merge commit>`, `git push origin v1.0.2`) and the one cut from `[Unreleased]` the same way, so the link references lead somewhere.

The link references, one per Version and one for `[Unreleased]`, newest first:

```markdown
[Unreleased]: https://github.com/christried/malkochen/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/christried/malkochen/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/christried/malkochen/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/christried/malkochen/releases/tag/v1.0.0
```

## Worked example

Version 1.0.0 is out. Two PRs outside a spec added lines to `[Unreleased]` as they merged:

```markdown
## [Unreleased]

### Fixed

- The Board no longer jumps to the top when you close Your Settings.
- Fixed: closing settings scrolled the board up on Android (again, after the first fix only covered desktop).

### Changed

- The add button is a bit bigger on phones.
```

Then the last ticket of a spec is implemented, say one that let Members plan Dishes for days of the week. Its PR turns that into two patches, the collected lines first, dated the same day:

```markdown
## [Unreleased]

## [1.0.2] - 2026-11-05

### Added

- Plan your week: drag a Dish onto a day, and everyone on the Board sees what's cooking when.

### Changed

- Diese Woche shows the days you've planned first.

## [1.0.1] - 2026-11-05

### Changed

- The add button is a bit bigger on phones.

### Fixed

- Closing Your Settings no longer sends the Board back to the top, on phones too.
```

The two "Fixed" lines became one, since the second only finished the first; "Fixed:" inside a Fixed section said nothing. The feature is made up. The German file gets the same two Versions, each language written on its own terms:

```markdown
## [1.0.2] - 2026-11-05

### Added

- Plan deine Woche: Zieh ein Gericht auf einen Tag, und alle auf dem Board sehen, was wann gekocht wird.

### Changed

- Diese Woche zeigt zuerst die Tage, die ihr schon geplant habt.
```

and the Italian one likewise, then `package.json` becomes `1.0.2`.
