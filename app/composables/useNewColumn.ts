// Imported, not auto-imported: its tests run in plain Node (the "client"
// Vitest project).
import { computed, ref } from 'vue'

// The field for a new Column's name, in Board settings and in the Board's
// add lane (desktop), with the same rules in both: the name is trimmed, an
// empty one can't be added, and one add at a time. `add` adds the Column
// (at the end of the Board, POST /api/boards/:id/columns); if it fails,
// the name stays in the field and `failed` says so. `submit` answers
// whether the Column was added, the field emptied.
export function useNewColumn(add: (name: string) => Promise<unknown>, failed: () => void) {
  const name = ref('')
  const adding = ref(false)
  const canAdd = computed(() => !!name.value.trim() && !adding.value)

  async function submit(): Promise<boolean> {
    const trimmed = name.value.trim()
    if (!trimmed || adding.value) return false
    adding.value = true
    try {
      await add(trimmed)
      name.value = ''
      return true
    }
    catch {
      failed()
      return false
    }
    finally {
      adding.value = false
    }
  }

  return { name, adding, canAdd, submit }
}
