<script setup lang="ts">
import type { PromptKind } from '~/utils/notification-prompt'

// A Notification Prompt (CONTEXT.md, #407, decided on #392: A): Topfbert's
// card at the bottom of the Board, offering Push Notifications or the Email
// Digest, with "Einschalten" and "Später". Not a modal: the Board stays
// usable behind it, and the card only speaks politely. BoardScreen decides
// when it shows and does what the buttons say.
const props = defineProps<{
  which: PromptKind
  // "Einschalten" is under way.
  busy: boolean
  // Why it didn't work out, if it didn't: the card stays.
  error: string | null
}>()
defineEmits<{ turnOn: [], later: [] }>()

const t = useStrings()
const titleId = useId()
const title = computed(() => props.which === 'push' ? t.prompt.pushTitle : t.prompt.digestTitle)
const text = computed(() => props.which === 'push' ? t.prompt.pushText : t.prompt.digestText)
</script>

<template>
  <!-- Above the FAB, below sheets and dialogs. The wrapper lets the Board's
       clicks through around the card. -->
  <div
    class="prompt pointer-events-none fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-[7] tablet:inset-x-auto tablet:bottom-6 tablet:right-6 tablet:w-[420px]"
    role="status"
  >
    <section
      class="pointer-events-auto flex items-start gap-3 rounded-card bg-surface p-4 text-text shadow-card"
      :aria-labelledby="titleId"
      :data-prompt="which"
    >
      <TopfbertIdle
        mood="happy"
        class="w-[88px] shrink-0"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <h2
          :id="titleId"
          class="font-display text-title-s"
        >
          {{ title }}
        </h2>
        <p class="text-small">
          {{ text }}
        </p>
        <p
          v-if="error"
          role="alert"
          class="text-small text-danger"
        >
          {{ error }}
        </p>
        <div class="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            class="rounded-pill bg-butter px-4 py-2 text-button text-on-accent disabled:opacity-60"
            :disabled="busy"
            :aria-busy="busy"
            @click="$emit('turnOn')"
          >
            {{ t.prompt.turnOn }}
          </button>
          <button
            type="button"
            class="rounded-pill bg-surface-muted px-4 py-2 text-button text-text disabled:opacity-60"
            :disabled="busy"
            @click="$emit('later')"
          >
            {{ t.prompt.later }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* The app's settle motion; reduced motion: a fade only. */
.prompt > section {
  animation: prompt-settle var(--dur-settle) var(--ease-settle) backwards;
}
@keyframes prompt-settle {
  from { opacity: 0; translate: 0 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .prompt > section { animation-name: prompt-fade; }
  @keyframes prompt-fade { from { opacity: 0; } }
}
</style>
