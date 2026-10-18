<script setup lang="ts">
import { LANGUAGE_CHOICES, type LanguageChoice } from '~~/shared/language'
import type { Me } from '~~/server/utils/people'

// "Sprache" in Your Settings (#326): Automatisch (the browser's language) or
// a language, each named in itself, as a segmented Input like Darstellung
// (ThemePicker). The app switches at once, without a reload; the choice is
// kept on the user, for every device. If keeping it fails, the app goes
// back to the one before and says so.
//
// Four choices don't fit a 360px phone in equal parts ("Automatisch",
// "Automatica"), so each takes the room its name needs and they share
// what's left (#327). The thumb is placed under the chosen one by
// measuring it; until it has been (the server's render), the chosen one
// carries the dark background itself.
const t = useStrings()
const choice = useLanguageChoice()
const { data: me } = useMe()
const chosen = computed(() => Math.max(0, LANGUAGE_CHOICES.indexOf(choice.value)))
const failed = ref(false)

const group = ref<HTMLElement>()
const thumb = ref<{ x: number, width: number } | null>(null)
// Only once it has been placed, so it doesn't slide in from the left.
const sliding = ref(false)

function place() {
  const button = group.value?.querySelectorAll<HTMLElement>('[role="radio"]')[chosen.value]
  if (button) thumb.value = { x: button.offsetLeft, width: button.offsetWidth }
}

// Fonts arriving, another language's names or a turned phone change the
// widths.
let resized: ResizeObserver | undefined
onMounted(() => {
  place()
  requestAnimationFrame(() => (sliding.value = true))
  resized = new ResizeObserver(place)
  for (const el of group.value!.children) resized.observe(el)
})
onBeforeUnmount(() => resized?.disconnect())
watch([chosen, () => t.userSettings.languages], () => nextTick(place))

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
      ref="group"
      class="relative grid rounded-pill bg-surface-muted p-1"
      :style="{ gridTemplateColumns: `repeat(${LANGUAGE_CHOICES.length}, auto)` }"
      role="radiogroup"
      :aria-label="t.userSettings.language"
    >
      <span
        v-if="thumb"
        aria-hidden="true"
        class="thumb absolute inset-y-1 left-0 rounded-pill bg-inverse"
        :class="{ sliding }"
        :style="{ width: `${thumb.width}px`, translate: `${thumb.x}px 0` }"
      />
      <button
        v-for="language in LANGUAGE_CHOICES"
        :key="language"
        type="button"
        role="radio"
        :lang="language === 'auto' ? undefined : language"
        :aria-checked="choice === language"
        class="relative whitespace-nowrap rounded-[var(--radius-pill)] px-2 py-2.5 text-button transition-colors duration-fade ease-fade focus-visible:outline-2 focus-visible:outline-focus"
        :class="choice === language ? ['text-on-inverse', { 'bg-inverse': !thumb }] : 'text-text hover:bg-line'"
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
@media (prefers-reduced-motion: no-preference) {
  .thumb.sliding {
    transition: translate 420ms var(--ease-pop), width 420ms var(--ease-pop);
  }
}
</style>
