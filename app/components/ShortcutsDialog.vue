<script setup lang="ts">
// "?" on the Board: a small dialog listing the keyboard shortcuts (the
// handoff's Dialog, confirm variant, with one "OK").
const open = defineModel<boolean>('open', { required: true })
const t = useStrings()
</script>

<template>
  <AppSheet
    v-model:open="open"
    variant="dialog"
    :title="t.shortcuts.title"
    :close-label="t.shortcuts.close"
  >
    <ShortcutList class="mt-5" />
    <div class="mt-6 flex flex-col">
      <button
        type="button"
        class="rounded-pill bg-inverse px-5 py-3.5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        @click="open = false"
      >
        {{ t.shortcuts.ok }}
      </button>
    </div>
  </AppSheet>
</template>
