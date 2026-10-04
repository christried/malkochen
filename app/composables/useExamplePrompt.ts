// A field's prompt with one of a few made-up examples in it, such as a Dish
// note's "Optional, z. B. …" or a new Board's name. It starts on the first,
// so a server render and the browser agree; `pickAnother()` (in the browser)
// picks one at random.
export function useExamplePrompt(examples: readonly string[], prompt: (example: string) => string) {
  const example = ref(examples[0]!)
  function pickAnother() {
    example.value = examples[Math.floor(Math.random() * examples.length)]!
  }
  return { prompt: computed(() => prompt(example.value)), pickAnother }
}
