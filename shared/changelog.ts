// The Changelog (CONTEXT.md, #354): what changed for users in each Version,
// read from the Keep a Changelog files at the repo root (CHANGELOG.md in
// English, CHANGELOG.de.md, CHANGELOG.it.md). Their section names stay
// English in every file; the page shows them in the viewer's language.
// Shared: the page renders it, the server compares Versions with it.

export const SECTION_KINDS = ['added', 'changed', 'removed', 'fixed', 'security'] as const
export type SectionKind = typeof SECTION_KINDS[number]

export interface ChangelogSection {
  kind: SectionKind
  entries: string[]
}

export interface Release {
  version: string
  // YYYY-MM-DD, as the file writes it.
  date: string
  sections: ChangelogSection[]
}

export interface Changelog {
  // What's live but in no Version yet ("Gerade neu"); empty for none.
  unreleased: ChangelogSection[]
  // Newest first, as the file lists them.
  versions: Release[]
}

const VERSION_HEADING = /^## \[([^\]]+)\](?: - (\d{4}-\d{2}-\d{2}))?\s*$/
const SECTION_HEADING = /^### (.+?)\s*$/
const ENTRY = /^- (.+)$/
// A line of an entry carried on below it, indented.
const CARRIED_ON = /^\s+(\S.*)$/

// Reads a Changelog's text. Anything else in it (the title, a paragraph
// under it, the link references at the bottom) is left out. Throws for what
// the page couldn't show: a section Keep a Changelog doesn't name, a
// Version without a date, an entry outside a section.
export function parseChangelog(text: string): Changelog {
  const changelog: Changelog = { unreleased: [], versions: [] }
  let sections: ChangelogSection[] | null = null
  let entries: string[] | null = null
  for (const line of text.split(/\r?\n/)) {
    const version = VERSION_HEADING.exec(line)
    if (version) {
      const [, number, date] = version
      entries = null
      if (number === 'Unreleased') {
        sections = changelog.unreleased
        continue
      }
      if (!date) throw new Error(`Changelog: Version ${number} has no date`)
      sections = []
      changelog.versions.push({ version: number!, date, sections })
      continue
    }
    const heading = SECTION_HEADING.exec(line)
    if (heading) {
      const kind = heading[1]!.toLowerCase() as SectionKind
      if (!SECTION_KINDS.includes(kind)) throw new Error(`Changelog: no section "${heading[1]}" in Keep a Changelog`)
      if (!sections) throw new Error(`Changelog: section "${heading[1]}" outside a Version`)
      entries = []
      sections.push({ kind, entries })
      continue
    }
    const entry = ENTRY.exec(line)
    if (entry) {
      if (!entries) throw new Error(`Changelog: entry outside a section: ${line}`)
      entries.push(entry[1]!.trim())
      continue
    }
    const carried = CARRIED_ON.exec(line)
    if (carried && entries?.length) entries[entries.length - 1] += ` ${carried[1]!.trim()}`
  }
  const filled = (list: ChangelogSection[]) => list.filter(({ entries }) => entries.length)
  return {
    unreleased: filled(changelog.unreleased),
    versions: changelog.versions.map(release => ({ ...release, sections: filled(release.sections) })),
  }
}

// What a user who never opened the Changelog counts as having seen.
const FIRST_VERSION = '1.0.0'

// Whether Version `current` (the app's, empty for none yet) is newer than
// `seen` (the last one a user saw; none, null or empty, counts as 1.0.0,
// so the first Version is never new to anyone).
export function newerVersion(current: string, seen: string | null): boolean {
  if (!current) return false
  const a = current.split('.').map(Number)
  const b = (seen || FIRST_VERSION).split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff) return diff > 0
  }
  return false
}

// The Versions the Changelog Popup lists (#406): every one newer than the
// `seen` one, in the file's order (newest first). What is live but in no
// Version yet ("Gerade neu") is not among them.
export function unseenReleases(changelog: Changelog, seen: string | null): Release[] {
  return changelog.versions.filter(({ version }) => newerVersion(version, seen))
}
