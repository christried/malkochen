<script setup lang="ts">
// PROTOTYPE #330: throwaway, never merge. The floating bar that switches the
// variants (dev only, mounted from app.vue). ← and → cycle the variants of
// the question picked; the chips pick the question. ?bar=0 hides it.
const route = useRoute()
const router = useRouter()
const { state, question, barShown, set, restore } = useP330()

onMounted(() => restore(route.query))

const current = computed(() => P330_QUESTIONS.find(q => q.key === question.value)!)
const index = computed(() => current.value.variants.findIndex(v => v.key === state.value[question.value]))
const variant = computed(() => current.value.variants[index.value] ?? current.value.variants[0]!)

function cycle(by: 1 | -1) {
  const list = current.value.variants
  const next = list[(index.value + by + list.length) % list.length]!
  set(question.value, next.key)
  void router.replace({ query: { ...route.query, [question.value]: next.key } })
}

function onKey(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable], [role="tablist"]')) return
  event.preventDefault()
  cycle(event.key === 'ArrowLeft' ? -1 : 1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    v-if="barShown"
    class="p330-bar"
  >
    <div class="p330-chips">
      <button
        v-for="q in P330_QUESTIONS"
        :key="q.key"
        type="button"
        :class="{ on: q.key === question }"
        @click="question = q.key"
      >
        {{ q.label }} <b>{{ state[q.key] }}</b>
      </button>
    </div>
    <div class="p330-row">
      <button
        type="button"
        aria-label="Vorherige Variante"
        @click="cycle(-1)"
      >
        ←
      </button>
      <span class="p330-label"><b>{{ variant.key }}</b> {{ variant.name }}<small>{{ current.where }}</small></span>
      <button
        type="button"
        aria-label="Nächste Variante"
        @click="cycle(1)"
      >
        →
      </button>
    </div>
  </div>
</template>

<style>
/* PROTOTYPE #330: the bar, plainly not part of the design. Top left, out of
   the way of the toast and the add button. */
.p330-bar {
  position: fixed;
  left: 50%;
  top: 8px;
  translate: -50% 0;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  padding: 8px 10px;
  border-radius: 18px;
  background: #111;
  color: #fff;
  font: 13px/1.3 system-ui, sans-serif;
  box-shadow: 0 8px 30px rgba(0, 0, 0, .45);
  max-width: calc(100vw - 16px);
  opacity: .92;
}
.p330-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
}
.p330-chips button {
  padding: 3px 9px;
  border-radius: 999px;
  background: #2a2a2a;
  color: #ccc;
}
.p330-chips button.on {
  background: #fff;
  color: #111;
}
.p330-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.p330-row > button {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: #2a2a2a;
  font-size: 16px;
}
.p330-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 200px;
  text-align: center;
}
.p330-label small {
  color: #999;
}
</style>
