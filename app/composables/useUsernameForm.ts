import type { Me } from '~~/server/utils/people'
import { typedUsername, usernameProblem } from '~~/shared/username'

// Typed as a plain string: Nitro's route typing runs too deep here.
const USERNAME: string = '/api/me/username'

// The field your Username is typed into (the prompt before your first Board,
// "Passt dein Name?" and your settings): what is typed, what is wrong with it
// as you type, and saving it. The server has the last word: a name someone
// else has, or too many changes in a day, come back in its words.
export function useUsernameForm(me: Ref<Me | undefined>) {
  const t = useStrings()
  const typed = ref(me.value?.name ?? '')
  const saving = ref(false)
  // "Too short" would nag from the first letter: said once saving was tried.
  const tried = ref(false)
  const refused = ref<string | null>(null)
  watch(typed, () => (refused.value = null))

  const username = computed(() => typedUsername(typed.value))
  const changed = computed(() => username.value !== me.value?.name)
  const message = computed(() => {
    const problem = usernameProblem(username.value)
    if (problem && (problem !== 'short' || tried.value)) return t.username.problem[problem]
    return refused.value
  })

  // Whether it is saved now (keeping the one you have counts: you're not
  // asked again).
  async function save(): Promise<boolean> {
    tried.value = true
    if (saving.value || usernameProblem(username.value)) return false
    saving.value = true
    refused.value = null
    try {
      me.value = await $fetch<Me>(USERNAME, { method: 'PUT', body: { username: username.value } })
      typed.value = me.value.name
      tried.value = false
      return true
    }
    catch (err) {
      refused.value = (err as { data?: { data?: { message?: string } } }).data?.data?.message ?? t.username.failed
      return false
    }
    finally {
      saving.value = false
    }
  }

  return { typed, changed, message, saving, save }
}
