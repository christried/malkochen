<script setup lang="ts">
import type { DishLinkView } from '~~/server/utils/dish-links'
import type { BoardListing } from '~~/server/utils/boards'
import type { CopiedDish } from '~~/server/utils/copies'
import { dishPath } from '~~/shared/address'

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
  throw createError({ statusCode: 429, statusMessage: 'Too many links not found', fatal: true })
}

// Signed in or not (#403): "Auf mein Board kopieren" copies the Dish to one of
// the user's Boards when signed in; signed out, it remembers the link through
// sign-in. The same request the page guard made (a 401 is signed out).
const { data: me } = await useFetch<{ id: string }>('/api/me', { key: `me:${route.fullPath}` })

// "Auf mein Board kopieren" (#403): the Board picker sheet (#402's
// CopyTargetPicker) and the Copy made from it.
const copyPicker = ref(false)
const copying = ref(false)
const toast = ref<Toast | null>(null)
const statusOf = (failure: unknown) => (failure as { statusCode?: number } | null)?.statusCode

async function copyFromLink() {
  if (copying.value) return
  if (!me.value) {
    copying.value = true
    try {
      await $fetch(`/api/dish-links/${link}/remember`, { method: 'POST' })
    }
    catch (failure) {
      copying.value = false
      if (statusOf(failure) === 404) dish.value = undefined
      else toast.value = { text: t.detail.copyFailed, duration: NOTICE_MS }
      return
    }
    // The sign-in lands on "/", which opens the Dish here again, with the picker.
    await navigateTo('/login')
    return
  }
  copyPicker.value = true
}

// Makes the Copy on `boardId` and opens it there. The Copy's notice about an
// image that couldn't be copied doesn't come along: the page changes.
async function copyInto(boardId: string) {
  copying.value = true
  try {
    const copied = await $fetch<CopiedDish>(`/api/dish-links/${link}/copy`, { method: 'POST', body: { boardId } })
    copyPicker.value = false
    await navigateTo(dishPath(copied.board, copied.dish))
  }
  catch (failure) {
    copying.value = false
    copyPicker.value = false
    if (statusOf(failure) === 404) dish.value = undefined
    else toast.value = { text: statusOf(failure) === 403 ? t.detail.copyForbidden : t.detail.copyFailed, duration: NOTICE_MS }
  }
}

function copyTo(toBoard: BoardListing) {
  return copyInto(toBoard.id)
}

// Signed in with no Board to copy to: a new one, starter name, then the Copy.
async function startBoard() {
  if (copying.value) return
  copying.value = true
  let created: { id: string }
  try {
    created = await $fetch<{ id: string }>('/api/boards', { method: 'POST', body: { name: t.boardStart.starter, emoji: '🍲' } })
  }
  catch {
    copying.value = false
    toast.value = { text: t.detail.copyFailed, duration: NOTICE_MS }
    return
  }
  await copyInto(created.id)
}

// Back from the sign-in with a remembered link (the landing sends us here
// with `?kopieren`): the picker opens once, and the query goes, so a reload
// doesn't open it again.
onMounted(() => {
  if (me.value && route.query.kopieren !== undefined) {
    copyPicker.value = true
    void navigateTo({ path: route.path, query: {} }, { replace: true })
  }
})

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
        <button
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-pill bg-butter px-5 py-3.5 text-button-l text-on-accent transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-focus"
          :disabled="copying"
          data-copy-from-link
          @click="copyFromLink"
        >
          {{ t.dishLink.copy }}
        </button>
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
        {{ t.invite.toApp }}
      </NuxtLink>
    </div>

    <AppSheet
      v-model:open="copyPicker"
      :title="t.detail.copyTo"
      :close-label="t.dish.closeMenu"
    >
      <CopyTargetPicker
        v-if="copyPicker"
        class="mt-5"
        :board-id="dish?.ownBoard"
        @copy="copyTo"
      >
        <template #empty>
          <p class="px-1 text-small text-text-muted">
            {{ t.dishLink.noBoards }}
          </p>
          <button
            type="button"
            class="mt-3 flex w-full items-center justify-center gap-2 rounded-pill bg-butter px-5 py-3.5 text-button-l text-on-accent transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-focus"
            :disabled="copying"
            data-start-board
            @click="startBoard"
          >
            {{ t.dishLink.startBoard }}
          </button>
        </template>
      </CopyTargetPicker>
    </AppSheet>
    <AppToast v-model="toast" />
  </main>
</template>
