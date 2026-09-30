<script setup lang="ts">
// A Board: its name and emoji and its Columns. Dishes come in later tickets.
interface BoardView {
  id: string
  name: string
  emoji: string
  isOwner: boolean
  columns: { id: string, name: string, isGekocht: boolean }[]
}

const t = useStrings()
const { signOut } = useAuth()
const route = useRoute()
const id = computed(() => String(route.params.id))

const { data: board, error } = await useFetch<BoardView>(() => `/api/boards/${id.value}`)
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusMessage, fatal: true })

// Remember this as the Board to reopen next time.
onMounted(() => $fetch(`/api/boards/${id.value}/open`, { method: 'POST' }))

useHead({ title: () => board.value ? `${board.value.emoji} ${board.value.name} · ${t.app.name}` : t.app.name })
</script>

<template>
  <main
    v-if="board"
    class="min-h-dvh bg-bg px-4 py-6 text-text tablet:px-10 desktop:px-16"
  >
    <header class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="font-display text-title-l tablet:text-display-m">
        <span aria-hidden="true">{{ board.emoji }}</span> {{ board.name }}
      </h1>
      <div class="flex flex-wrap items-center gap-3">
        <ThemePicker />
        <button
          type="button"
          class="rounded-pill px-4 py-2.5 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          @click="signOut"
        >
          {{ t.board.signOut }}
        </button>
      </div>
    </header>

    <div class="mt-8 flex snap-x gap-4 overflow-x-auto pb-4">
      <section
        v-for="column in board.columns"
        :key="column.id"
        :aria-label="column.name"
        class="w-[min(85vw,340px)] shrink-0 snap-start rounded-panel bg-surface-muted p-4"
        :data-gekocht="column.isGekocht || undefined"
      >
        <h2 class="font-display text-title-s">
          {{ column.name }}
        </h2>
        <p class="mt-6 text-small text-text-muted">
          {{ t.board.emptyColumn }}
        </p>
      </section>
    </div>
  </main>
</template>
