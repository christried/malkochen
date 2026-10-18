<script setup lang="ts">
import { LANGUAGE_CHOICES, type LanguageChoice } from '~~/shared/language'
import type { Me } from '~~/server/utils/people'

// "Sprache" in Your Settings (#326): Automatisch (the browser's language) or
// a language, each named in itself, as a segmented Input like Darstellung
// (ThemePicker). The app switches at once, without a reload; the choice is
// kept on the user, for every device. If keeping it fails, the app goes
// back to the one before and says so.
const t = useStrings()
const choice = useLanguageChoice()
const { data: me } = useMe()
const chosen = computed(() => Math.max(0, LANGUAGE_CHOICES.indexOf(choice.value)))
const failed = ref(false)

// Typed as a plain string: Nitro's route typing runs too deep here.
const LANGUAGE: string = '/api/me/language'

// Only the latest pick counts, however the answers come back.
let latest = 0

async function choose(language: LanguageChoice) {
  if (language === choice.value) return
  const before = choice.value
  const pick = ++latest
  failed.value = false
  choice.value = language
  try {
    const answer = await $fetch<Me>(LANGUAGE, { method: 'PUT', body: { language } })
    if (pick === latest) me.value = answer
  }
  catch {
    if (pick !== latest) return
    choice.value = before
    failed.value = true
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      class="relative grid rounded-pill bg-surface-muted p-1"
      :style="{ gridTemplateColumns: `repeat(${LANGUAGE_CHOICES.length}, minmax(0, 1fr))`, '--chosen': chosen, '--count': LANGUAGE_CHOICES.length }"
      role="radiogroup"
      :aria-label="t.userSettings.language"
    >
      <span
        aria-hidden="true"
        class="thumb absolute inset-y-1 left-1 rounded-pill bg-inverse"
      />
      <button
        v-for="language in LANGUAGE_CHOICES"
        :key="language"
        type="button"
        role="radio"
        :lang="language === 'auto' ? undefined : language"
        :aria-checked="choice === language"
        class="relative rounded-[var(--radius-pill)] px-3 py-2.5 text-button transition-colors duration-fade ease-fade focus-visible:outline-2 focus-visible:outline-focus"
        :class="choice === language ? 'text-on-inverse' : 'text-text hover:bg-line'"
        @click="choose(language)"
      >
        {{ t.userSettings.languages[language] }}
      </button>
    </div>
    <p
      :role="failed ? 'alert' : 'status'"
      class="px-1 text-small text-danger empty:hidden"
    >{{ failed ? t.userSettings.languageFailed : '' }}</p>
  </div>
</template>

<style scoped>
.thumb {
  width: calc((100% - .5rem) / var(--count));
  translate: calc(var(--chosen) * 100%) 0;
  transition: translate 420ms var(--ease-pop);
}
@media (prefers-reduced-motion: reduce) {
  .thumb {
    transition: none;
  }
}
</style>
