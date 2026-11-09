import type { ShallowRef } from 'vue'
import type { UnsentChanges } from '~/board/unsent-changes'

// The signed-in user's Unsent Changes (plugins/unsent-changes.client.ts).
// `current`: the open ones, reactive, null until a Board page has opened
// them; `open(userId)` opens them (null on the server, which has none).
export function useUnsentChanges() {
  const unsent = useNuxtApp().$unsent as { current: ShallowRef<UnsentChanges | null>, open: (userId: string) => UnsentChanges } | undefined
  return {
    current: unsent?.current ?? shallowRef<UnsentChanges | null>(null),
    open: (userId: string): UnsentChanges | null => unsent?.open(userId) ?? null,
  }
}
