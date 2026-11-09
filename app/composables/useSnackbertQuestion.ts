import type { InjectionKey } from 'vue'
import type { createSnackbertQuestion, SnackbertAsking } from '~/snackbert/snackbert-question'

// The Snackbert Question (#425) as the Board provides it: the module that
// decides when he asks (snackbert/snackbert-question.ts), and `report`,
// which opens the report sheet for the Cooking he asked about ("Ja").
// SnackbertQuestion draws it on the Board and, as the Toast is, in the Dish
// detail, which makes the Board behind it inert.
export interface ProvidedSnackbertQuestion {
  question: ReturnType<typeof createSnackbertQuestion>
  report: (asked: SnackbertAsking) => void
}

export const snackbertQuestionKey: InjectionKey<ProvidedSnackbertQuestion> = Symbol('snackbert-question')

// Null outside a Board.
export function useSnackbertQuestion(): ProvidedSnackbertQuestion | null {
  return inject(snackbertQuestionKey, null)
}
