<script setup lang="ts">
// The handoff's Button "danger": danger-coloured text on a 10% danger pill.
</script>

<template>
  <button
    type="button"
    class="rounded-pill bg-danger/10 px-5 py-3.5 text-button text-danger transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
  >
    <slot />
  </button>
</template>
