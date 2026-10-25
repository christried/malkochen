<script setup lang="ts">
// PROTOTYPE #392: throwaway, never merge. Dev only, mounted from app.vue on
// Boards (/b/…): the Changelog Popup (?popup=A|B|C) and the Notification
// Prompt (?prompt=A|B, ?which=push|digest). Both stay put until dismissed,
// so the screenshots can take them as they are.
const route = useRoute()
const onBoard = computed(() => route.path.startsWith('/b/'))
const popup = computed(() => onBoard.value && typeof route.query.popup === 'string' ? p392Variant('popup', route.query) : null)
const prompt = computed(() => onBoard.value && typeof route.query.prompt === 'string' ? p392Variant('prompt', route.query) : null)
const which = computed<P392Prompt>(() => route.query.which === 'digest' ? 'digest' : 'push')
const popupOpen = ref(true)
const promptOpen = ref(true)
watch(() => route.fullPath, () => {
  popupOpen.value = true
  promptOpen.value = true
})
const newest = P392_POPUP_ENTRIES[0]!
const older = P392_POPUP_ENTRIES.slice(1)
const copy = computed(() => which.value === 'push'
  ? {
      title: 'Push-Benachrichtigungen?',
      text: 'Dann erfährst du, sobald in einem deiner Boards kommentiert oder abgestimmt wird. Nur in der installierten App.',
    }
  : {
      title: 'Den E-Mail-Digest einschalten?',
      text: 'Einmal die Woche eine Mail mit allem, was in deinen Boards neu ist. Abschalten kannst du sie jederzeit.',
    })
</script>

<template>
  <!-- The Changelog Popup -->
  <div
    v-if="popup && popupOpen"
    class="p392-popup"
    :data-variant="popup"
  >
    <div
      v-if="popup === 'A'"
      class="p392-scrim"
      @click="popupOpen = false"
    />
    <section
      v-if="popup === 'A'"
      class="p392-sheet"
      aria-label="Was ist neu"
    >
      <div class="p392-grab" />
      <h2 class="font-display text-title-m">
        Was ist neu
      </h2>
      <div
        v-for="v in P392_POPUP_ENTRIES"
        :key="v.version"
        class="flex flex-col gap-2"
      >
        <p class="text-small text-text-muted">
          Version {{ v.version }} · {{ v.date }}
        </p>
        <ul class="flex list-disc flex-col gap-1.5 pl-5 text-body">
          <li
            v-for="e in v.entries"
            :key="e"
          >
            {{ e }}
          </li>
        </ul>
      </div>
      <div class="flex items-center justify-between gap-3 pt-2">
        <NuxtLink
          to="/changelog"
          class="text-button text-text underline"
        >
          Alle Änderungen
        </NuxtLink>
        <button
          type="button"
          class="rounded-pill bg-butter px-5 py-2.5 text-button text-on-accent"
          @click="popupOpen = false"
        >
          Alles klar
        </button>
      </div>
    </section>

    <section
      v-else-if="popup === 'B'"
      class="p392-centre"
      aria-label="Was ist neu"
    >
      <div class="flex items-end gap-3">
        <TopfbertIdle
          mood="wow"
          class="w-[92px] shrink-0"
        />
        <div class="flex flex-col gap-1">
          <h2 class="font-display text-title-m">
            Was ist neu
          </h2>
          <p class="text-small text-text-muted">
            Version {{ newest.version }} · {{ newest.date }}
          </p>
        </div>
      </div>
      <ul class="flex list-disc flex-col gap-1.5 pl-5 text-body">
        <li
          v-for="e in newest.entries"
          :key="e"
        >
          {{ e }}
        </li>
      </ul>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <NuxtLink
          to="/changelog"
          class="text-button text-text underline"
        >
          Alle Änderungen
        </NuxtLink>
        <button
          type="button"
          class="rounded-pill bg-butter px-5 py-2.5 text-button text-on-accent"
          @click="popupOpen = false"
        >
          Alles klar
        </button>
      </div>
    </section>

    <section
      v-else
      class="p392-strip"
      aria-label="Was ist neu"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <p class="font-display text-title-s">
          Was ist neu <span class="text-small text-text-muted">· {{ newest.version }}</span>
        </p>
        <p class="truncate text-small">
          {{ newest.entries[0] }} <NuxtLink
            to="/changelog"
            class="underline"
          >Mehr</NuxtLink>
        </p>
        <p class="text-caption text-text-muted">
          Dazu {{ older.length + newest.entries.length - 1 }} weitere Einträge
        </p>
      </div>
      <button
        type="button"
        aria-label="Schließen"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted"
        @click="popupOpen = false"
      >
        <AppIcon
          name="close"
          :size="16"
        />
      </button>
    </section>
  </div>

  <!-- The Notification Prompt -->
  <div
    v-if="prompt && promptOpen"
    class="p392-prompt"
    :class="`p392-prompt-${prompt}`"
    :data-variant="prompt"
    :data-which="which"
  >
    <section
      class="p392-card"
      :aria-label="copy.title"
    >
      <TopfbertIdle
        mood="happy"
        :class="prompt === 'A' ? 'w-[88px] shrink-0' : 'w-[64px] shrink-0'"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <h2 class="font-display text-title-s">
          {{ copy.title }}
        </h2>
        <p class="text-small">
          {{ copy.text }}
        </p>
        <div class="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            class="rounded-pill bg-butter px-4 py-2 text-button text-on-accent"
            @click="promptOpen = false"
          >
            Einschalten
          </button>
          <button
            type="button"
            class="rounded-pill bg-surface-muted px-4 py-2 text-button text-text"
            @click="promptOpen = false"
          >
            Später
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style>
/* PROTOTYPE #392: the overlays, shaped by hand for the look only. */
.p392-popup {
  position: fixed;
  inset: 0;
  z-index: 2147482000;
  pointer-events: none;
}
.p392-scrim {
  position: absolute;
  inset: 0;
  background: var(--color-scrim, rgba(0, 0, 0, .35));
  pointer-events: auto;
}
.p392-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 80dvh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px 20px 24px;
  border-radius: 28px 28px 0 0;
  background: var(--color-surface, #fff8fb);
  color: var(--color-text, #4a2b3a);
  box-shadow: 0 -10px 30px rgba(0, 0, 0, .2);
  pointer-events: auto;
}
.p392-grab {
  width: 44px;
  height: 5px;
  margin: 0 auto;
  border-radius: 999px;
  background: var(--color-line-strong, #c9a9b8);
}
.p392-centre {
  position: absolute;
  left: 50%;
  top: 50%;
  translate: -50% -50%;
  width: min(420px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: 28px;
  background: var(--color-surface, #fff8fb);
  color: var(--color-text, #4a2b3a);
  box-shadow: 0 14px 40px rgba(0, 0, 0, .3);
  pointer-events: auto;
}
.p392-strip {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 20px;
  background: var(--color-surface, #fff8fb);
  color: var(--color-text, #4a2b3a);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .25);
  pointer-events: auto;
}
.p392-prompt {
  position: fixed;
  z-index: 2147481000;
  pointer-events: none;
}
.p392-prompt-A {
  left: 12px;
  right: 12px;
  bottom: 12px;
}
.p392-prompt-B {
  left: 12px;
  right: 12px;
  top: 64px;
}
@media (min-width: 768px) {
  .p392-prompt-A {
    left: auto;
    right: 24px;
    width: 420px;
  }
  .p392-prompt-B {
    left: 50%;
    right: auto;
    translate: -50% 0;
    width: min(680px, calc(100vw - 48px));
  }
}
.p392-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: 24px;
  background: var(--color-surface, #fff8fb);
  color: var(--color-text, #4a2b3a);
  box-shadow: 0 10px 30px rgba(0, 0, 0, .25);
  pointer-events: auto;
}
</style>
