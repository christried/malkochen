<script setup lang="ts">
// Topfbert stirring while the Recipe Finder searches (handoff
// RecipeFinderState, layers.json → search, #504): the stir mood with three
// pieces that sink behind the rim and peek out of the pot. One loop of 4.8s
// (--dur-search), half the tempo of his stir so it never pulls the eye from
// the lists around it: the whole of him breathes, the spoon stirs, the pieces
// peek in turn, the hat sways. Always at 56×60, so none of the rules for
// under 48px apply. Drawn in code from the handoff's own markup rather than
// played by SvgLoop: the drawing is small and static. Reduced motion: no
// loop, frame 0 (spoon upright, one piece peeking). Stands still while the
// modal he's in has another over it. `leaving`: the search is over and he
// hops away with the card (r13-hop, 300ms).
defineProps<{ leaving?: boolean }>()
const covered = useCoveredByModal()
</script>

<template>
  <svg
    width="56"
    height="60"
    viewBox="0 -20 140 150"
    class="topfbert-search overflow-visible"
    :class="{ leaving, still: covered }"
    aria-hidden="true"
    data-topfbert-search
  >
    <g class="whole">
      <g class="spoon">
        <rect
          x="68.25"
          y="-12.75"
          width="6.5"
          height="73.5"
          rx="4"
          fill="#D9A86C"
          stroke="#1F1E1C"
          stroke-width="2.5"
        />
      </g>
      <g transform="translate(-28 0)">
        <g
          class="piece piece-1"
          style="transform: translateY(13px)"
        >
          <rect
            x="63.25"
            y="31.25"
            width="15.5"
            height="15.5"
            rx="5.5"
            fill="#F08A5D"
            stroke="#1F1E1C"
            stroke-width="2.5"
          />
        </g>
      </g>
      <g transform="translate(27 0)">
        <g
          class="piece piece-2"
          style="transform: translateY(13px)"
        >
          <circle
            cx="69.5"
            cy="37.5"
            r="6.25"
            fill="#8DB596"
            stroke="#1F1E1C"
            stroke-width="2.5"
          />
        </g>
      </g>
      <g transform="translate(10 0)">
        <g
          class="piece piece-3"
          style="transform: translateY(-1px)"
        >
          <rect
            x="63.25"
            y="31.25"
            width="14.5"
            height="14.5"
            rx="7"
            fill="#F7D58A"
            stroke="#1F1E1C"
            stroke-width="2.5"
          />
        </g>
      </g>
      <rect
        x="9.25"
        y="59.25"
        width="19.5"
        height="10.5"
        rx="5.5"
        fill="#C7E0CD"
        stroke="#1F1E1C"
        stroke-width="2.5"
      />
      <rect
        x="111.25"
        y="59.25"
        width="19.5"
        height="10.5"
        rx="5.5"
        fill="#C7E0CD"
        stroke="#1F1E1C"
        stroke-width="2.5"
      />
      <path
        d="M21.25 48V88A38.75 34.75 0 0 0 60 122.75H80A38.75 34.75 0 0 0 118.75 88V48Z"
        fill="#A5C7AE"
        stroke="#1F1E1C"
        stroke-width="2.5"
      />
      <path
        d="M45.5 76A5 5 0 0 1 55.5 76M84.5 76A5 5 0 0 1 94.5 76"
        fill="none"
        stroke="#1F1E1C"
        stroke-width="3"
        stroke-linecap="round"
      />
      <ellipse
        cx="41.5"
        cy="86"
        rx="7.5"
        ry="4"
        fill="#F4A9A0"
        opacity=".85"
      />
      <ellipse
        cx="98.5"
        cy="86"
        rx="7.5"
        ry="4"
        fill="#F4A9A0"
        opacity=".85"
      />
      <path
        d="M59.5 82H78.5A9.5 8.5 0 0 1 59.5 82Z"
        fill="#1F1E1C"
      />
      <ellipse
        cx="66"
        cy="87"
        rx="4.5"
        ry="3"
        fill="#F08A8A"
      />
      <rect
        x="13.25"
        y="41.25"
        width="113.5"
        height="12.5"
        rx="6.5"
        fill="#C7E0CD"
        stroke="#1F1E1C"
        stroke-width="2.5"
      />
      <g class="hat">
        <g transform="rotate(-14 36 46)">
          <circle
            cx="22"
            cy="6"
            r="10.75"
            fill="#fff"
            stroke="#1F1E1C"
            stroke-width="2.5"
          />
          <circle
            cx="39"
            cy="1"
            r="11.75"
            fill="#fff"
            stroke="#1F1E1C"
            stroke-width="2.5"
          />
          <circle
            cx="50"
            cy="8"
            r="8.75"
            fill="#fff"
            stroke="#1F1E1C"
            stroke-width="2.5"
          />
          <rect
            x="16"
            y="8"
            width="40"
            height="22"
            fill="#fff"
          />
          <rect
            x="16.25"
            y="23.25"
            width="39.5"
            height="13.5"
            rx="3"
            fill="#fff"
            stroke="#1F1E1C"
            stroke-width="2.5"
          />
        </g>
      </g>
    </g>
  </svg>
</template>

<style scoped>
/* The loop (layers.json → search; keyframes in loops.css): the whole of him
   breathes and the spoon stirs twice per loop, the pieces peek in turn, the
   hat sways once. Pivots in the drawing's own units. */
.whole,
.spoon,
.hat {
  transform-box: view-box;
}
.whole {
  transform-origin: 70px 123px;
}
.spoon {
  transform-origin: 71.5px 54.4px;
}
.hat {
  transform-origin: 36px 46px;
}
@media (prefers-reduced-motion: no-preference) {
  .whole {
    animation: r13-breathe calc(var(--dur-search) / 2) var(--ease-search) infinite both;
  }
  .spoon {
    animation: r13-stir calc(var(--dur-search) / 2) var(--ease-search) infinite both;
  }
  .hat {
    animation: r13-hat var(--dur-search) var(--ease-search) infinite both;
  }
  .piece-1 {
    animation: r13-peek var(--dur-search) var(--ease-search) -600ms infinite both;
  }
  .piece-2 {
    animation: r13-peek var(--dur-search) var(--ease-search) -2200ms infinite both;
  }
  .piece-3 {
    animation: r13-peek var(--dur-search) var(--ease-search) -3800ms infinite both;
  }
  /* Under a modal that another opened over. */
  .still :is(.whole, .spoon, .hat, .piece) {
    animation-play-state: paused;
  }
}
/* The search is over: he hops and shrinks away with the card. */
.leaving {
  animation: r13-hop 300ms ease-out forwards;
}
</style>
