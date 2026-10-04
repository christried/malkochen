// The prompt in a Dish's note field: "Optional, z. B. …" with one of the
// made-up examples. It starts on the first, so a server render and the
// browser agree; `pickAnother()` (in the browser) picks one at random.
export function useNoteExample() {
  const t = useStrings()
  const example = ref(t.dishNote.examples[0]!)
  const prompt = computed(() => t.dishNote.prompt(example.value))
  function pickAnother() {
    const examples = t.dishNote.examples
    example.value = examples[Math.floor(Math.random() * examples.length)]!
  }
  return { prompt, pickAnother }
}
