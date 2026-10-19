// What a Comment (CONTEXT.md) may be, for the server's check and the
// comment field: trimmed, never empty, at most COMMENT_MAX characters. In
// app/, not shared/: the server build keeps shared/ files apart, and one
// the app only imports by a relative path (as the Board module, which its
// tests run in plain Node, must) isn't found there (#332).
export const COMMENT_MAX = 1000

// The text as the server keeps it: trimmed; null if that leaves nothing, or
// too much.
export function commentText(text: string): string | null {
  const trimmed = text.trim()
  return trimmed && trimmed.length <= COMMENT_MAX ? trimmed : null
}
