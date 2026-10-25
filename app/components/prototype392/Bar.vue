<script setup lang="ts">
// PROTOTYPE #392: throwaway, never merge. The floating bar that switches the
// variants (dev only, mounted from app.vue). The chips pick the question; ←
// and → cycle its variants. ?bar=0 hides it (for screenshots).
const route = useRoute()
const router = useRouter()

const question = useState<P392Question>('prototype-392-question', () => 'changelog')
const current = computed(() => P392_QUESTIONS.find(q => q.key === question.value)!)
const picked = computed(() => p392Variant(question.value, route.query))
const index = computed(() => current.value.variants.findIndex(v => v.key === picked.value))
const variant = computed(() => current.value.variants[index.value] ?? current.value.variants[0]!)
const shown = computed(() => route.query.bar !== '0')

// Which page a question lives on: the Changelog and the Dish Link page are
// their own pages; the others are on a Board, so the bar takes you to one.
function pageFor(key: P392Question): string | null {
  if (key === 'changelog') return '/changelog'
  if (key === 'dish') return '/prototype392/dish'
  return null
}

function set(key: P392Question, value: string, replace = true) {
  p392Remember(key, value)
  const query = { ...route.query, [key]: value }
  const to = pageFor(key)
  if (to && route.path !== to) {
    void router.push({ path: to, query })
    return
  }
  if (replace) void router.replace({ query })
}

function cycle(by: 1 | -1) {
  const list = current.value.variants
  const next = list[(index.value + by + list.length) % list.length]!
  set(question.value, next.key)
}

function pick(key: P392Question) {
  question.value = key
  const to = pageFor(key)
  if (to && route.path !== to) void router.push({ path: to, query: { ...route.query, [key]: p392Variant(key, route.query) } })
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
    v-if="shown"
    class="p392-bar"
  >
    <div class="p392-chips">
      <button
        v-for="q in P392_QUESTIONS"
        :key="q.key"
        type="button"
        :class="{ on: q.key === question }"
        @click="pick(q.key)"
      >
        {{ q.label }} <b>{{ p392Variant(q.key, route.query) }}</b>
      </button>
    </div>
    <div class="p392-row">
      <button
        type="button"
        aria-label="Vorherige Variante"
        @click="cycle(-1)"
      >
        ←
      </button>
      <span class="p392-label"><b>{{ variant.key }}</b> {{ variant.name }}<small>{{ current.where }}</small></span>
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
/* PROTOTYPE #392: the bar, plainly not part of the design. */
.p392-bar {
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
.p392-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
}
.p392-chips button {
  padding: 3px 9px;
  border-radius: 999px;
  background: #2a2a2a;
  color: #ccc;
}
.p392-chips button.on {
  background: #fff;
  color: #111;
}
.p392-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.p392-row > button {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: #2a2a2a;
  font-size: 16px;
}
.p392-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 200px;
  text-align: center;
}
.p392-label small {
  color: #999;
}
</style>
