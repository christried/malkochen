# Writing the Changelog

How to keep the Changelog (`CONTEXT.md` → Changelog, Version) without the user having to remind anyone. The page `/changelog` ("Was ist neu") is built from three files at the repo root: `CHANGELOG.md` (English), `CHANGELOG.de.md` and `CHANGELOG.it.md`. Spec: #323. How a Release brings the lines to production: `docs/development.md`.

## The rule

- **Only what users notice.** Something a person using malkochen would see, feel or be protected by. Tests, CI, refactors, docs, dependency updates and anything else nobody notices never go in.
- **Five sections, English in every file:** `### Added`, `### Changed`, `### Removed`, `### Fixed`, `### Security`. The app shows them translated. Any other section name breaks the build (`shared/changelog.ts`).
- **The app's tone.** Casual and warm, as the app's strings speak (`app/strings/`): "du" in German, "tu" in Italian. Plain sentences, no dashes or middle dots as separators, no Markdown inside a line (the page shows it as plain text). The domain words from `CONTEXT.md`: Dish, Board, Gekocht, Klassiker, and so on, in each language as the app's strings name them.
- **All three files in the same PR,** with the same Versions and dates (`tests/client/changelog.test.ts` checks it).
- **A PR outside a spec that users notice** adds its line under `## [Unreleased]` in the same PR. Staging shows it at once as "Gerade neu"; production's "Gerade neu" stays empty until a Release brings the lines there.
- **A spec's last ticket writes its one entry, with no Version and no date.** "Changelog entry for this spec" writes the spec's entry under `## [Unreleased]`, in all three files. A spec reads as one change, not twenty PRs, so the spec's other PRs add nothing. A spec that changes nothing users notice gets no such ticket.
- **A Release dates everything under `[Unreleased]` as one Version.** The Release's first PR, into `staging`, does it: the newest Version plus one in the last number, dated the day of that PR. A minor only when the Operator agrees to one.
- **A minor Version only after asking.** If the Release's features look big enough for one (1.1.0 rather than 1.0.8), ask the Operator and wait for the yes. Without it, a patch, even the 37th.
- **The app's version follows.** `package.json`'s `version` is the newest Version in the files (the same test checks it). The Release sets it, not the spec's tickets. It became 1.0.0 with the release (#356).
- **Tags follow the Release.** After its merge into `main`, the Release's merge commit is tagged with the Version. A hotfix is a Release of its own, tagged the same way.

## Writing a spec's entry, step by step

1. Read the spec and its closed tickets. Collect what users notice, grouped by section. Leave out what nobody notices, even if it took the most work.
2. Write the entry under `## [Unreleased]`, in the sections it needs, merged with the lines already there. Merge duplicates, drop lines a later change made untrue, and keep each one sentence or two.
3. Do it in all three files, in the same sections. Write each language on its own terms rather than word for word.
4. Leave out the Version, the date, the link references and `package.json`: the Release sets them.
5. Run `pnpm vitest run tests/client/changelog.test.ts`.

## Cutting a Release, step by step

When the Operator says "Release". The steps are also in `docs/development.md`.

1. In a PR into `staging`, rewrite `[Unreleased]` into one new Version: the newest Version plus one, or the minor the Operator agreed to, today's date. Keep `## [Unreleased]` above it, empty.
2. Do it in all three files, the same Version and date in each.
3. Update the link references at the bottom of each file (below).
4. Set `package.json`'s `version` to the new Version.
5. Run `pnpm vitest run tests/client/changelog.test.ts`.
6. Merge on green CI. Then a PR `staging` → `main` titled "Release x.y.z", merged on green CI with a merge commit, straight after.
7. Tag the merge commit on `main`: `git tag v1.0.2 <merge commit>`, `git push origin v1.0.2`. The first tag, `v1.0.0`, marks the release of 1.0.0 (#356).

The link references, one per Version and one for `[Unreleased]`, newest first:

```markdown
[Unreleased]: https://github.com/christried/malkochen/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/christried/malkochen/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/christried/malkochen/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/christried/malkochen/releases/tag/v1.0.0
```

## Worked example

Version 1.0.0 is out. Two PRs outside a spec added lines to `[Unreleased]` as they merged into `staging`. Then the last ticket of a spec, one that let Members plan Dishes for days of the week, wrote its entry in the same place:

```markdown
## [Unreleased]

### Added

- Plan your week: drag a Dish onto a day, and everyone on the Board sees what's cooking when.

### Changed

- The add button is a bit bigger on phones.

### Fixed

- The Board no longer jumps to the top when you close Your Settings.
- Fixed: closing settings scrolled the board up on Android (again, after the first fix only covered desktop).
```

The Release's PR dates it as one patch, 1.0.1, and leaves `[Unreleased]` empty:

```markdown
## [Unreleased]

## [1.0.1] - 2026-11-05

### Added

- Plan your week: drag a Dish onto a day, and everyone on the Board sees what's cooking when.

### Changed

- The add button is a bit bigger on phones.

### Fixed

- Closing Your Settings no longer sends the Board back to the top, on phones too.
```

The two "Fixed" lines became one, since the second only finished the first; "Fixed:" inside a Fixed section said nothing. The feature is made up. The German file gets the same Version, each language written on its own terms:

```markdown
## [1.0.1] - 2026-11-05

### Added

- Plan deine Woche: Zieh ein Gericht auf einen Tag, und alle auf dem Board sehen, was wann gekocht wird.
```

and the Italian one likewise, then `package.json` becomes `1.0.1`.
