<script setup lang="ts">
// PROTOTYPE #422: throwaway, never merge. The confirmation after "Senden"
// outside the sheet: B, Snackbert pops up with his abacus, says one line and
// leaves with it; C, a toast with his head. Both in the top layer (a manual
// popover shown last), so they show over the Dish detail too. ?danke-bleibt=1
// keeps them (for the screenshots).
const state = useP422()
const picks = useP422Picks()
const route = useRoute()
const c = computed(() => picks.value.copy)
const stay = computed(() => route.query['danke-bleibt'] === '1')

const layer = useTemplateRef<HTMLElement>('layer')
const showing = ref<null | { kind: 'B' | 'C', key: number, leaving: boolean }>(null)

let timer: ReturnType<typeof setTimeout> | undefined
function show(kind: 'B' | 'C', key: number) {
  clearTimeout(timer)
  showing.value = { kind, key, leaving: false }
  nextTick(() => {
    const el = layer.value
    if (!el) return
    if (el.matches(':popover-open')) el.hidePopover()
    el.showPopover()
  })
  if (stay.value) return
  timer = setTimeout(() => {
    if (showing.value) showing.value.leaving = true
    timer = setTimeout(() => (showing.value = null), 400)
  }, kind === 'B' ? 2800 : 3200)
}

watch(() => state.value.thanks, (t) => {
  if (!t) return
  state.value.thanks = null
  // "Bestätigung zeigen" in the bar shows the picked one; A lives in the sheet.
  if (picks.value.danke === 'A') {
    state.value.sheet = { dish: 'Cremige Pilzpasta', cookingId: null }
    return
  }
  show(picks.value.danke === 'B' ? 'B' : 'C', t.key)
})
watch(() => state.value.toast, (on) => {
  if (!on) return
  state.value.toast = false
  show('C', Date.now())
})
onMounted(() => {
  if (route.query['danke-zeigen'] === '1' && picks.value.danke !== 'A') show(picks.value.danke === 'B' ? 'B' : 'C', 1)
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div
    ref="layer"
    popover="manual"
    class="p422-layer"
  >
    <div
      v-if="showing?.kind === 'B'"
      :key="showing.key"
      class="p422-grab"
      :class="{ leaving: showing.leaving }"
      data-p422-thanks="B"
    >
      <p class="p422-grab-bubble font-display">
        {{ c.thanks[picks.text] }}
      </p>
      <img
        :src="P422_FACE.smart"
        alt=""
      >
    </div>
    <div
      v-else-if="showing?.kind === 'C'"
      :key="showing.key"
      class="p422-toast"
      :class="{ leaving: showing.leaving }"
      role="status"
      data-p422-thanks="C"
    >
      <img
        :src="P422_FACE.happy"
        alt=""
      >
      <span>{{ c.toast }}</span>
    </div>
  </div>
</template>

<style scoped>
.p422-layer {
  inset: 0;
  width: 100vw;
  height: 100dvh;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  overflow: visible;
  pointer-events: none;
}

.p422-grab {
  position: fixed;
  right: 20px;
  bottom: 24px;
  display: flex;
  align-items: flex-end;
  gap: 4px;
}
.p422-grab img {
  width: 128px;
  filter: drop-shadow(0 10px 14px rgba(0, 0, 0, .25));
  animation: p422-up 620ms var(--ease-pop) backwards;
}
.p422-grab-bubble {
  max-width: 200px;
  margin-bottom: 70px;
  border-radius: 20px 20px 4px 20px;
  background: var(--color-surface);
  color: var(--color-text);
  padding: 12px 14px;
  font-size: 17px;
  line-height: 1.3;
  box-shadow: var(--shadow-card), 0 0 0 1px var(--color-line);
  animation: p422-bubble 420ms var(--ease-pop) 320ms backwards;
  transform-origin: right bottom;
}
.p422-grab.leaving img { animation: p422-away 420ms var(--ease-swoosh) forwards; }
.p422-grab.leaving .p422-grab-bubble { animation: p422-fade-out 200ms var(--ease-fade) forwards; }

.p422-toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  translate: -50% 0;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 999px;
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  padding: 6px 20px 6px 8px;
  font: 500 15px/1.3 var(--font-ui);
  box-shadow: var(--shadow-fab);
  white-space: nowrap;
  animation: p422-toast 380ms var(--ease-sheet) backwards;
}
.p422-toast img { width: 40px; margin-top: -10px; animation: p422-bob 1200ms var(--ease-idle) 400ms 2; }
.p422-toast.leaving { animation: p422-toast-out 300ms var(--ease-swoosh) forwards; }

@keyframes p422-up { from { translate: 0 180px; rotate: 10deg; } }
@keyframes p422-away {
  30% { translate: 0 -10px; rotate: -6deg; }
  to { translate: 180px 40px; rotate: 18deg; }
}
@keyframes p422-bubble { from { opacity: 0; scale: .6; } }
@keyframes p422-fade-out { to { opacity: 0; } }
@keyframes p422-toast { from { opacity: 0; translate: -50% 150px; } }
@keyframes p422-toast-out { to { opacity: 0; translate: -50% 150px; } }
@keyframes p422-bob { 50% { translate: 0 -3px; rotate: -6deg; } }
</style>
