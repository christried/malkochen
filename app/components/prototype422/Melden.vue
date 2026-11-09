<script setup lang="ts">
// PROTOTYPE #422: throwaway, never merge. "Snackbert melden" and "gemeldet"
// on a Cooking in the Dish History, only on the Member's own Cookings (each
// reports for themselves; only they see it). ?melden=A a pill under the
// line, B his head as a button beside the bin, C a text link under the line.
// DishHistory mounts it twice: `place="side"` (B) and `place="below"` (A, C).
// ?gemeldet=1 shows every own Cooking as reported (for the screenshots).
const props = defineProps<{ cookingId: string | null, dish: string, place: 'side' | 'below' }>()
const state = useP422()
const picks = useP422Picks()
const route = useRoute()
const c = computed(() => picks.value.copy)
const reported = computed(() => route.query.gemeldet === '1' || (!!props.cookingId && state.value.reported.includes(props.cookingId)))
const shown = computed(() => (props.place === 'side') === (picks.value.melden === 'B'))

function open() {
  if (reported.value) return
  state.value.sheet = { dish: props.dish, cookingId: props.cookingId }
}
</script>

<template>
  <template v-if="shown">
    <!-- B: his head beside the bin. -->
    <button
      v-if="picks.melden === 'B'"
      type="button"
      class="p422-head -my-1.5"
      :class="{ done: reported }"
      :aria-label="reported ? c.reportedLong : c.report"
      :data-tooltip="reported ? c.reportedLong : c.report"
      data-p422-melden="B"
      @click="open"
    >
      <img
        :src="reported ? P422_FACE.happy : P422_FACE.think"
        alt=""
      >
      <span
        v-if="reported"
        class="p422-tick"
        aria-hidden="true"
      >✓</span>
    </button>

    <!-- A: a pill under the line. -->
    <template v-else-if="picks.melden === 'A'">
      <button
        v-if="!reported"
        type="button"
        class="p422-pill self-start"
        data-p422-melden="A"
        @click="open"
      >
        <img
          :src="P422_FACE.think"
          alt=""
        >
        {{ c.report }}
      </button>
      <span
        v-else
        class="p422-pill is-done self-start"
        data-p422-melden="A"
      >
        <img
          :src="P422_FACE.happy"
          alt=""
        >
        {{ c.reportedLong }} ✓
      </span>
    </template>

    <!-- C: a text link under the line. -->
    <template v-else>
      <button
        v-if="!reported"
        type="button"
        class="p422-link self-start"
        data-p422-melden="C"
        @click="open"
      >
        {{ c.report }} →
      </button>
      <span
        v-else
        class="self-start text-caption text-text-muted"
        data-p422-melden="C"
      >
        ✓ {{ c.reportedLong }}
      </span>
    </template>
  </template>
</template>

<style scoped>
.p422-head {
  position: relative;
  display: flex;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  transition: scale var(--dur-tap) var(--ease-tap), background-color var(--dur-fade);
}
.p422-head:hover { background: var(--color-surface-muted); }
.p422-head:active { scale: .92; }
.p422-head img { width: 26px; }
.p422-head.done img { opacity: .75; }
.p422-tick {
  position: absolute;
  right: -2px;
  bottom: -2px;
  display: flex;
  width: 15px;
  height: 15px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--color-sage);
  color: var(--color-sage-ink);
  font: 800 9px/1 var(--font-ui);
  box-shadow: 0 0 0 2px var(--color-bg);
}
.p422-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--color-butter) 30%, var(--color-surface-muted));
  padding: 3px 12px 3px 4px;
  font: 600 13px/1.2 var(--font-ui);
  transition: scale var(--dur-tap) var(--ease-tap);
}
.p422-pill:active { scale: .95; }
.p422-pill img { width: 24px; }
.p422-pill.is-done {
  background: transparent;
  padding-left: 0;
  color: var(--color-text-muted);
  font-weight: 500;
}
.p422-pill.is-done img { width: 20px; }
.p422-link {
  font: 600 13px/1.2 var(--font-ui);
  color: var(--color-name-ink);
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
</style>
