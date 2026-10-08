<script setup lang="ts">
// The Board's keyboard shortcuts, one line each: the "?" dialog
// (ShortcutsDialog) and your settings both show this, from the one list in
// utils/shortcuts.ts.
const t = useStrings()
</script>

<template>
  <ul class="flex flex-col gap-2">
    <li
      v-for="shortcut in SHORTCUTS"
      :key="shortcut.action"
      class="flex items-center gap-3"
    >
      <span class="flex w-16 shrink-0 items-center gap-1 text-text-muted">
        <template
          v-for="(key, i) in shortcut.keys"
          :key="key"
        >
          <span
            v-if="i > 0"
            class="text-small"
          >–</span>
          <kbd class="inline-flex h-8 min-w-8 items-center justify-center rounded-field bg-surface-muted px-2 [font-family:inherit] text-button text-text shadow-[inset_0_-2px_0_var(--color-line-strong)]">{{ key }}</kbd>
        </template>
      </span>
      <span class="text-body">{{ t.shortcuts.does[shortcut.action] }}</span>
    </li>
  </ul>
</template>
