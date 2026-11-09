<script setup lang="ts">
// PROTOTYPE #422: throwaway, never merge. The floating bar that switches the
// variants (dev only). The chips pick the question; ← and → cycle its
// variants. "Frage zeigen" and "Blatt öffnen" play them again. ?bar=0 hides
// it (for screenshots). Mounted from app.vue on the Board, and inside the
// Dish detail (a modal: the page's bar is inert behind it).
const props = defineProps<{ inModal?: boolean }>()
const route = useRoute()
const router = useRouter()
const state = useP422()

const question = useState<P422Question>('prototype-422-question', () => 'frage')
const current = computed(() => P422_QUESTIONS.find(q => q.key === question.value)!)
const picked = computed(() => p422Variant(question.value, route.query))
const index = computed(() => current.value.variants.findIndex(v => v.key === picked.value))
const variant = computed(() => current.value.variants[index.value] ?? current.value.variants[0]!)
const onPage = computed(() => route.path.startsWith('/b/') && (props.inModal ? !!route.params.dish : !route.params.dish))
const shown = computed(() => route.query.bar !== '0' && onPage.value)

function set(key: P422Question, value: string) {
  p422Remember(key, value)
  void router.replace({ query: { ...route.query, [key]: value } })
}

function cycle(by: 1 | -1) {
  const list = current.value.variants
  const next = list[(index.value + by + list.length) % list.length]!
  set(question.value, next.key)
  replay()
}

// After a switch, the Question or the sheet plays again in the new variant.
function replay() {
  const q = question.value
  if (['frage', 'wie', 'blase', 'text'].includes(q) && !route.params.dish) ask()
  if (q === 'danke') p422Thanks()
}

function ask() {
  state.value.sheet = null
  p422Ask('Cremige Pilzpasta')
}

function openSheet() {
  state.value.asking = null
  state.value.sheet = { dish: 'Cremige Pilzpasta', cookingId: null }
}

function onKey(event: KeyboardEvent) {
  if (!shown.value) return
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
    v-if="shown"
    class="p422-bar"
  >
    <div class="p422-chips">
      <button
        v-for="q in P422_QUESTIONS"
        :key="q.key"
        type="button"
        :class="{ on: q.key === question }"
        @click="question = q.key"
      >
        {{ q.label }} <b>{{ p422Variant(q.key, route.query) }}</b>
      </button>
    </div>
    <div class="p422-row">
      <button
        type="button"
        aria-label="Vorherige Variante"
        @click="cycle(-1)"
      >
        ←
      </button>
      <span class="p422-label"><b>{{ variant.key }}</b> {{ variant.name }}<small>{{ current.where }}</small></span>
      <button
        type="button"
        aria-label="Nächste Variante"
        @click="cycle(1)"
      >
        →
      </button>
    </div>
    <div class="p422-chips">
      <button
        v-if="!route.params.dish"
        type="button"
        @click="ask"
      >
        Frage zeigen
      </button>
      <button
        type="button"
        @click="openSheet"
      >
        Blatt öffnen
      </button>
      <button
        type="button"
        @click="p422Thanks"
      >
        Bestätigung zeigen
      </button>
    </div>
  </div>
</template>

<style>
/* PROTOTYPE #422: the bar, plainly not part of the design. */
.p422-bar {
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
  font: 12px/1.3 system-ui, sans-serif;
  box-shadow: 0 8px 30px rgba(0, 0, 0, .45);
  width: max-content;
  max-width: calc(100vw - 16px);
  opacity: .92;
}
.p422-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
}
.p422-chips button {
  padding: 3px 8px;
  border-radius: 999px;
  background: #2a2a2a;
  color: #ccc;
}
.p422-chips button.on {
  background: #fff;
  color: #111;
}
.p422-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.p422-row > button {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: #2a2a2a;
  font-size: 15px;
}
.p422-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 180px;
  text-align: center;
}
.p422-label small {
  color: #999;
}
</style>
