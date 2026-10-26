// So %, _ and \ in a search text match themselves in a LIKE pattern (\ is
// Postgres's LIKE escape).
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, c => `\\${c}`)
}
