import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MIGRATIONS_FOLDER } from '../../server/db/migrate'

interface Journal {
  entries: { tag: string }[]
}

// A copy of the committed migrations up to, not including, the one tagged
// `tag` (its file name without .sql), for a test that seeds a database as it
// was before that migration and then applies the rest.
export async function migrationsBefore(tag: string): Promise<{ folder: string, remove: () => Promise<void> }> {
  const journal = JSON.parse(await readFile(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')) as Journal
  const index = journal.entries.findIndex(e => e.tag === tag)
  if (index < 0) throw new Error(`no migration tagged ${tag}`)
  const entries = journal.entries.slice(0, index)

  const folder = await mkdtemp(join(tmpdir(), 'malkochen-migrations-'))
  await mkdir(join(folder, 'meta'))
  await writeFile(join(folder, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries }))
  for (const { tag } of entries) await cp(join(MIGRATIONS_FOLDER, `${tag}.sql`), join(folder, `${tag}.sql`))
  return { folder, remove: () => rm(folder, { recursive: true, force: true }) }
}
