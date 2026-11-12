<script setup lang="ts">
// The Recipe Finder in Your Settings (#498, ADR 0013, design R13
// RecipeFinderSettings): shown to every user, in three states. Off: what it
// does and "Zugang anfragen". Asked: a chip and one sentence that closes the
// loop. On: a sage chip and the consent sentence, which says Caption and page
// text go to Anthropic. No switch: only the Operator switches it. Read again
// whenever the settings are `open`, so a switch by the Operator meanwhile
// shows.
const props = defineProps<{ open: boolean }>()
const t = useStrings()
const finder = useRecipeFinder()
watch(() => props.open, (isOpen) => {
  if (isOpen) void finder.refresh()
}, { immediate: true })

const status = finder.status
const state = computed(() => status.value?.state ?? 'off')
const askedAt = computed(() => status.value?.state === 'asked' ? status.value.askedAt : null)

// The state first read just appears; only changes after that move: the
// button folds and the chip pops on asking, the chip crossfades when the
// Operator switches it on while the settings are open.
const known = ref(false)
watch(status, async (now) => {
  if (!now || known.value) return
  await nextTick()
  known.value = true
}, { flush: 'post', immediate: true })

const headingId = useId()
</script>

<template>
  <section
    class="flex flex-col gap-3"
    :aria-labelledby="headingId"
  >
    <h3
      :id="headingId"
      class="section-heading px-1"
    >
      {{ t.recipeFinder.heading }}
    </h3>
    <div
      class="finder rounded-card bg-surface-muted p-4"
      :class="{ animated: known }"
      :aria-busy="status === null"
    >
      <div class="flex min-h-8 items-center gap-2.5">
        <span class="flex-1 text-button-l">{{ t.recipeFinder.heading }}</span>
        <Transition
          name="finder-chip"
          mode="out-in"
          :css="known"
        >
          <span
            v-if="state === 'asked'"
            key="asked"
            class="flex h-7 items-center gap-1.5 rounded-chip bg-surface pl-2 pr-2.5 text-caption font-semibold text-text"
          >
            <AppIcon
              name="check"
              :size="13"
            />{{ t.recipeFinder.asked }}
          </span>
          <span
            v-else-if="state === 'on'"
            key="on"
            class="flex h-7 items-center gap-1.5 rounded-chip bg-sage pl-2 pr-2.5 text-caption font-semibold text-sage-ink"
          >
            <span
              aria-hidden="true"
              class="size-2 rounded-full bg-sage-ink"
            />{{ t.recipeFinder.on }}
          </span>
        </Transition>
      </div>

      <Transition
        name="finder-text"
        mode="out-in"
        :css="known"
      >
        <p
          v-if="state === 'on'"
          key="on"
          class="mt-3 text-body text-text"
        >
          {{ t.recipeFinder.onLine }}
          <NuxtLink
            to="/datenschutz"
            class="text-small text-text-muted underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-focus"
          >{{ t.recipeFinder.privacyLink }}</NuxtLink>
        </p>
        <p
          v-else
          key="about"
          class="mt-3 text-body text-text"
        >
          {{ t.recipeFinder.about }}
        </p>
      </Transition>

      <!-- The button folds away once asked (height and fade); folded, it is
           out of reach for keyboard and screen readers too. -->
      <div
        class="fold"
        :class="{ folded: state !== 'off' }"
        :inert="state !== 'off'"
      >
        <div class="fold-inner">
          <button
            type="button"
            class="mt-3 h-11 rounded-pill bg-inverse px-5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            :disabled="finder.busy.value || status === null"
            @click="finder.ask()"
          >
            {{ t.recipeFinder.ask }}
          </button>
        </div>
      </div>

      <Transition
        name="finder-text"
        :css="known"
      >
        <p
          v-if="askedAt"
          class="mt-3 text-small text-text-muted"
        >
          {{ t.recipeFinder.askedLine(askedAt) }}
        </p>
      </Transition>

      <p
        :role="finder.failed.value ? 'alert' : 'status'"
        class="mt-3 text-small text-danger empty:hidden"
      >{{ finder.failed.value ? t.recipeFinder.askFailed : '' }}</p>
    </div>
  </section>
</template>

<style scoped>
/* The button folds away: its height and opacity go in "settle" time. The row
   height goes by a grid row from 1fr to 0fr. Reduced motion zeroes the
   durations (tokens.css). */
.fold {
  display: grid;
  grid-template-rows: 1fr;
}
.fold-inner {
  min-height: 0;
  overflow: hidden;
  /* Room for the focus ring, which overflow would cut off. */
  margin: -4px;
  padding: 4px;
}
.fold-inner > button {
  /* Left-aligned at its own width. */
  display: block;
}
.fold.folded {
  grid-template-rows: 0fr;
  opacity: 0;
  visibility: hidden;
}
.animated .fold {
  transition: grid-template-rows var(--dur-settle) var(--ease-settle), opacity var(--dur-settle) var(--ease-settle), visibility 0s linear 0s;
}
.animated .fold.folded {
  transition: grid-template-rows var(--dur-settle) var(--ease-settle), opacity var(--dur-settle) var(--ease-settle), visibility 0s linear var(--dur-settle);
}

/* The chip pops in; one that goes fades out. */
.finder-chip-enter-active {
  transition: opacity var(--dur-fade) var(--ease-fade), scale var(--dur-pop) var(--ease-pop);
}
.finder-chip-leave-active {
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.finder-chip-enter-from {
  opacity: 0;
  scale: 0.7;
}
.finder-chip-leave-to {
  opacity: 0;
}

/* Text that changes crossfades. */
.finder-text-enter-active,
.finder-text-leave-active {
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.finder-text-enter-from,
.finder-text-leave-to {
  opacity: 0;
}
</style>
