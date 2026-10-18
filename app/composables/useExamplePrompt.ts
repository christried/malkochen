// Imported, not auto-imported: its tests run in plain Node (the "client"
// Vitest project).
import { computed, ref } from 'vue'

// A field's prompt with one of a few made-up examples in it, such as a Dish
// note's "Optional, z. B. …", a new Board's name or a new Column's. It starts
// on the first, so a server render and the browser agree; `pickAnother()` (in
// the browser) picks one at random. Both are read as the prompt is shown, so
// it follows the language the app is in (useStrings): another language
// shows the same example in its own words.
export function useExamplePrompt(examples: () => readonly string[], prompt: (example: string) => string) {
  const index = ref(0)
  function pickAnother() {
    index.value = Math.floor(Math.random() * examples().length)
  }
  return { prompt: computed(() => prompt(examples()[index.value] ?? examples()[0]!)), pickAnother }
}
