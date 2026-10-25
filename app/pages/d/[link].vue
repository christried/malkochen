<script setup lang="ts">
import type { DishLinkView } from '~~/server/utils/dish-links'

// The Dish Link page (CONTEXT.md: Dish Link; #392 decision 4, variant A): one
// Dish for anyone with the link, signed in or not: its image (with its Focus
// Point), title, Creator and Source, and nothing of its Board. In the
// viewer's language (useStrings follows the browser's when signed out).
// Messengers preview it through Open Graph; search engines are told not to
// index it. A Dish that is archived, on an Archived Board or deleted for good
// is a friendly "not found" in the card's place.
const t = useStrings()
const route = useRoute()
const link = String(route.params.link)
const origin = useRequestURL().origin

const { data: dish, error } = await useFetch<DishLinkView>(`/api/dish-links/${link}`)
// Too many links that don't exist asked for from here, for now (429): not a
// link that stopped working, so the error screen says to try again soon.
if (error.value?.statusCode === 429) {
  throw createError({ statusCode: 429, statusMessage: 'Too many Invite Links not found', fatal: true })
}

// The Dish's image for a preview when it is a link a messenger can fetch,
// else the app's icon.
const previewImage = computed(() => dish.value?.imageUrl?.startsWith('https://') ? dish.value.imageUrl : `${origin}/icons/icon-512.png`)

useSeoMeta({
  title: () => dish.value?.title ?? t.dishLink.goneTitle,
  ogTitle: () => dish.value?.title ?? t.dishLink.goneTitle,
  ogType: 'website',
  ogImage: () => previewImage.value,
  ogUrl: () => `${origin}${dish.value?.path ?? route.path}`,
  robots: 'noindex',
})
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-8 text-text">
    <article
      v-if="dish"
      class="flex w-full max-w-[440px] flex-col overflow-hidden rounded-card bg-surface shadow-card desktop:max-w-[520px]"
    >
      <div class="aspect-[4/5] w-full bg-surface-muted">
        <DishImage
          :image-url="dish.imageUrl"
          :focus="dish.focus"
          :placeholder="dish.placeholder"
        />
      </div>
      <div class="flex flex-col gap-3 p-5">
        <h1 class="font-display text-title-l">
          {{ dish.title }}
        </h1>
        <p
          v-if="dish.creator || dish.source"
          class="flex flex-wrap items-center gap-2 text-small text-text-muted"
        >
          <span v-if="dish.creator">{{ t.dishLink.by(dish.creator) }}</span>
          <SourceBadge
            v-if="dish.source"
            :kind="dish.source.kind"
          />
        </p>
        <!-- #403 puts "Auf mein Board kopieren" here, above "Zur Quelle". -->
        <a
          v-if="dish.source"
          :href="dish.source.link"
          target="_blank"
          rel="noopener noreferrer"
          class="text-center text-button text-text underline focus-visible:outline-2 focus-visible:outline-focus"
        >{{ t.dishLink.toSource }}</a>
      </div>
    </article>

    <div
      v-else
      class="flex max-w-md flex-col items-center text-center"
    >
      <TopfbertIdle
        mood="oops"
        class="w-[min(60vw,240px)]"
      />
      <h1 class="mt-8 font-display text-display-m">
        {{ t.dishLink.goneTitle }}
      </h1>
      <p class="mt-4 text-body text-text-muted">
        {{ t.dishLink.goneBody }}
      </p>
      <NuxtLink
        to="/"
        class="mt-8 rounded-pill bg-surface-muted px-6 py-4 text-button-l text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
      >
        {{ t.dishLink.toApp }}
      </NuxtLink>
    </div>
  </main>
</template>
