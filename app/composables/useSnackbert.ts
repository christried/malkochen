// Typed as a plain string: Nitro's route typing runs too deep here.
const SNACKBERT: string = '/api/me/snackbert'

// What the last switch ran into: no Snackbert account for the email address
// (409), Snackbert not reachable (502), or anything else.
export type SnackbertProblem = 'failed' | 'noAccount' | 'unreachable'

// Snackbert in your settings (#423): whether you have a Snackbert account
// (`available`, which only then shows the section at all), whether you
// switched it on (null until known), and switching it. One switch for all
// your devices, kept on the server. `problem`: the last action didn't work
// out, and why.
export function useSnackbert() {
  const available = ref(false)
  const on = ref<boolean | null>(null)
  const busy = ref(false)
  const problem = ref<SnackbertProblem | null>(null)

  async function refresh() {
    if (import.meta.server) return
    problem.value = null
    try {
      const state = await $fetch<{ available: boolean, on: boolean }>(SNACKBERT)
      available.value = state.available
      on.value = state.on
    }
    catch {
      available.value = false
    }
  }

  async function turn(next: boolean) {
    if (busy.value) return
    busy.value = true
    problem.value = null
    try {
      await $fetch(SNACKBERT, { method: next ? 'PUT' : 'DELETE' })
      on.value = next
    }
    catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      // Without an account the line stays until the sheet is opened again,
      // so the reason stays in view.
      if (status === 409) {
        problem.value = 'noAccount'
        on.value = false
      }
      else if (status === 502) {
        problem.value = 'unreachable'
      }
      else {
        problem.value = 'failed'
      }
    }
    finally {
      busy.value = false
    }
  }

  return { available, on, busy, problem, refresh, turn }
}
