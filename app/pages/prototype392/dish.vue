<script setup lang="ts">
// PROTOTYPE #392: throwaway, never merge. Dev only. The Dish Link page as a
// signed-out visitor sees it (the Dish's image, title, Creator and Source, and
// "Auf mein Board kopieren"), in three variants (?dish=A|B|C), and the Dish
// detail's share buttons in two (?share=A|B) under it. Static and made up.
// The auth middleware lets /prototype392 through in dev only.
definePageMeta({ layout: false })
useHead({ title: 'Dish Link · Prototyp #392' })

const route = useRoute()
const variant = computed(() => p392Variant('dish', route.query))
const share = computed(() => p392Variant('share', route.query))

const dish = {
  title: 'Cremige Pilzpasta',
  placeholder: 'pasta' as const,
  creator: 'pastaqueen',
  source: 'tiktok' as const,
  sourceLabel: 'TikTok',
}
</script>

<template>
  <main
    class="min-h-dvh bg-bg text-text"
    :data-variant="variant"
  >
    <!-- A: a centred card, image on top -->
    <div
      v-if="variant === 'A'"
      class="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center gap-4 px-4 py-8 desktop:max-w-[520px]"
    >
      <article class="flex flex-col overflow-hidden rounded-card bg-surface shadow-card">
        <div class="aspect-[4/5] w-full bg-surface-muted">
          <DishImage
            :image-url="null"
            :placeholder="dish.placeholder"
          />
        </div>
        <div class="flex flex-col gap-3 p-5">
          <h1 class="font-display text-title-l">
            {{ dish.title }}
          </h1>
          <p class="flex flex-wrap items-center gap-2 text-small text-text-muted">
            <span>von {{ dish.creator }}</span>
            <SourceBadge :kind="dish.source" />
          </p>
          <button
            type="button"
            class="mt-2 rounded-pill bg-butter px-5 py-3 text-button-l text-on-accent"
          >
            Auf mein Board kopieren
          </button>
          <a
            href="#"
            class="text-center text-button text-text underline"
          >Zur Quelle</a>
        </div>
      </article>
    </div>

    <!-- B: the image full bleed, the text over its foot -->
    <div
      v-else-if="variant === 'B'"
      class="relative min-h-dvh"
    >
      <div class="absolute inset-0 bg-surface-muted">
        <DishImage
          :image-url="null"
          :placeholder="dish.placeholder"
        />
      </div>
      <div class="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-5 pb-8 pt-40 text-white desktop:mx-auto desktop:max-w-[520px] desktop:pb-12">
        <h1 class="font-display text-display-m">
          {{ dish.title }}
        </h1>
        <p class="flex flex-wrap items-center gap-2 text-small">
          <span>von {{ dish.creator }}</span>
          <SourceBadge :kind="dish.source" />
        </p>
        <button
          type="button"
          class="rounded-pill bg-butter px-5 py-3 text-button-l text-on-accent"
        >
          Auf mein Board kopieren
        </button>
        <a
          href="#"
          class="text-center text-button underline"
        >Zur Quelle</a>
      </div>
    </div>

    <!-- C: the image on top, the sheet lifted over its foot -->
    <div
      v-else
      class="mx-auto flex min-h-dvh max-w-[440px] flex-col desktop:max-w-[520px]"
    >
      <div class="aspect-[4/5] w-full bg-surface-muted">
        <DishImage
          :image-url="null"
          :placeholder="dish.placeholder"
        />
      </div>
      <div class="-mt-12 flex flex-1 flex-col gap-3 rounded-t-[28px] bg-surface px-5 pb-8 pt-6 shadow-card">
        <h1 class="font-display text-title-l">
          {{ dish.title }}
        </h1>
        <p class="flex flex-wrap items-center gap-2 text-small text-text-muted">
          <span>von {{ dish.creator }}</span>
          <SourceBadge :kind="dish.source" />
        </p>
        <button
          type="button"
          class="mt-2 rounded-pill bg-butter px-5 py-3 text-button-l text-on-accent"
        >
          Auf mein Board kopieren
        </button>
        <a
          href="#"
          class="text-center text-button text-text underline"
        >Zur Quelle</a>
      </div>
    </div>

    <!-- The Dish detail's share buttons, as they would sit in it -->
    <section
      class="mx-auto mt-6 flex max-w-[440px] flex-col gap-3 rounded-card bg-surface p-4 desktop:max-w-[520px]"
      :data-share="share"
      aria-label="Dish-Detail, Teilen"
    >
      <p class="text-caption text-text-muted">
        Dish-Detail, Teilen (Variante {{ share }})
      </p>
      <template v-if="share === 'A'">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="flex items-center gap-2 rounded-pill bg-surface-muted px-4 py-2.5 text-button"
          >
            <AppIcon
              name="link"
              :size="18"
            />Link teilen
          </button>
          <button
            type="button"
            class="flex items-center gap-2 rounded-pill bg-surface-muted px-4 py-2.5 text-button"
          >
            Kopieren
          </button>
          <span class="ml-auto text-small text-text-muted">Bearbeiten</span>
        </div>
      </template>
      <template v-else>
        <div class="flex flex-col gap-2">
          <button
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-pill bg-butter px-4 py-3 text-button-l text-on-accent"
          >
            <AppIcon
              name="link"
              :size="18"
            />Link teilen
          </button>
          <button
            type="button"
            class="w-full rounded-pill bg-surface-muted px-4 py-3 text-button"
          >
            Kopieren
          </button>
        </div>
      </template>
    </section>
  </main>
</template>
