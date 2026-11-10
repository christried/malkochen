import { shallowRef } from 'vue'

// The question asked while Unsent Changes wait on the device (#463): before
// signing out (`signOut`), or when someone else signed in on a device that
// holds another user's (`switch`); `needsNet` only tells that signing out
// didn't get through. One at a time for the whole app, shown by
// LeavingQuestion in the app shell. Client only: nothing asks on the server.
export interface LeavingQuestion {
  kind: 'signOut' | 'switch' | 'needsNet'
  count: number
  answer: (goAhead: boolean) => void
}

const question = shallowRef<LeavingQuestion | null>(null)

export function useLeavingQuestion() {
  function ask(kind: 'signOut' | 'switch' | 'needsNet', count = 0): Promise<boolean> {
    return new Promise((resolve) => {
      // Another one asked meanwhile: the earlier is answered no (the safe
      // answer: nothing is discarded, nobody signed out).
      question.value?.answer(false)
      question.value = { kind, count, answer: (goAhead) => {
        question.value = null
        resolve(goAhead)
      } }
    })
  }
  return { question, ask }
}
