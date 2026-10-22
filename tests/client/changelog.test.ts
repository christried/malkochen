import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { de } from '../../app/strings/de'
import { en } from '../../app/strings/en'
import { it as italian } from '../../app/strings/it'
import { newerVersion, parseChangelog } from '../../shared/changelog'

// The Changelog (CONTEXT.md, #354): three files in the Keep a Changelog
// format, which the page is built from. The section names stay English in
// every file; the page shows them in the viewer's language.

const EXAMPLE = `# Changelog

Everything users notice, newest first.

## [Unreleased]

### Fixed

- The Board scrolls back to where it was.

## [1.0.1] - 2026-11-02

### Added

- Votes on every Dish.
- Comments, with
  a second line.

### Changed

- Gekocht shows who cooked.

## [1.0.0] - 2026-10-30

### Security

- Sign-in with a code.

[Unreleased]: https://github.com/christried/malkochen/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/christried/malkochen/compare/v1.0.0...v1.0.1
`

test('reads Unreleased, each Version with its date, and its sections in order', () => {
  expect(parseChangelog(EXAMPLE)).toEqual({
    unreleased: [{ kind: 'fixed', entries: ['The Board scrolls back to where it was.'] }],
    versions: [
      {
        version: '1.0.1',
        date: '2026-11-02',
        sections: [
          { kind: 'added', entries: ['Votes on every Dish.', 'Comments, with a second line.'] },
          { kind: 'changed', entries: ['Gekocht shows who cooked.'] },
        ],
      },
      { version: '1.0.0', date: '2026-10-30', sections: [{ kind: 'security', entries: ['Sign-in with a code.'] }] },
    ],
  })
})

test('an empty Unreleased has no sections, and a file with only that has no Versions', () => {
  expect(parseChangelog('# Changelog\n\n## [Unreleased]\n')).toEqual({ unreleased: [], versions: [] })
  expect(parseChangelog('## [Unreleased]\n\n### Added\n\n## [1.0.0] - 2026-10-30\n\n### Removed\n\n- The old switcher.\n')).toEqual({
    unreleased: [],
    versions: [{ version: '1.0.0', date: '2026-10-30', sections: [{ kind: 'removed', entries: ['The old switcher.'] }] }],
  })
})

test.each([
  ['a section Keep a Changelog doesn\'t know', '## [1.0.0] - 2026-10-30\n\n### Improved\n\n- Faster.\n'],
  ['a Version without a date', '## [1.0.0]\n\n### Added\n\n- Votes.\n'],
  ['an entry outside a section', '## [1.0.0] - 2026-10-30\n\n- Votes.\n'],
])('%s is refused', (_, text) => {
  expect(() => parseChangelog(text)).toThrow()
})

test.each([
  ['1.0.1', '1.0.0', true],
  ['1.0.10', '1.0.9', true],
  ['1.1.0', '1.0.37', true],
  ['1.0.0', '1.0.0', false],
  ['1.0.0', '1.0.1', false],
  ['1.0.0', null, true],
  ['', null, false],
])('%s is newer than %s: %s', (current, seen, newer) => {
  expect(newerVersion(current, seen)).toBe(newer)
})

const FILES = ['CHANGELOG.md', 'CHANGELOG.de.md', 'CHANGELOG.it.md']
const parsed = FILES.map(file => parseChangelog(readFileSync(file, 'utf8')))

test('all three files parse, with the same Versions and dates, newest first', () => {
  const versions = parsed.map(changelog => changelog.versions.map(({ version, date }) => ({ version, date })))
  expect(versions[1]).toEqual(versions[0])
  expect(versions[2]).toEqual(versions[0])
  const numbers = versions[0]!.map(({ version }) => version)
  expect(numbers).toEqual(numbers.toSorted((a, b) => newerVersion(a, b) ? -1 : 1))
})

test('the app\'s version is the newest Version', () => {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version?: string }
  expect(version ?? null).toBe(parsed[0]!.versions[0]?.version ?? null)
})

test('a Version\'s day carries its year, in each language', () => {
  expect(de.changelog.date('2026-10-30')).toBe('30. Okt. 2026')
  expect(en.changelog.date('2026-10-30')).toBe('30 Oct 2026')
  expect(italian.changelog.date('2026-10-30')).toBe('30 ott 2026')
})
