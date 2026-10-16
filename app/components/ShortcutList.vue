<script setup lang="ts">
// The Board's keyboard shortcuts, one line each: the "?" dialog
// (ShortcutsDialog) and your settings both show this, from the one list in
// utils/shortcuts.ts. Last, how to select several Dishes: Strg (⌘ on Apple
// devices) and a click, which the Board handles itself.
const t = useStrings()
const modifier = useModifierKey()
const kbd = 'inline-flex h-8 min-w-8 items-center justify-center rounded-field bg-surface-muted px-2 [font-family:inherit] text-button text-text shadow-[inset_0_-2px_0_var(--color-line-strong)]'
</script>

<template>
  <ul class="flex flex-col gap-2">
    <li
      v-for="shortcut in SHORTCUTS"
      :key="shortcut.action"
      class="flex items-center gap-3"
    >
      <span class="flex w-32 shrink-0 items-center gap-1 text-text-muted">
        <template
          v-for="(key, i) in shortcut.keys"
          :key="key"
        >
          <span
            v-if="i > 0"
            class="text-small"
          >–</span>
          <kbd :class="kbd">{{ key }}</kbd>
        </template>
      </span>
      <span class="text-body">{{ t.shortcuts.does[shortcut.action] }}</span>
    </li>
    <li class="flex items-center gap-3">
      <span class="flex w-32 shrink-0 items-center gap-1 text-text-muted">
        <kbd :class="kbd">{{ modifier }}</kbd>
        <span class="text-small">+</span>
        <kbd :class="kbd">{{ t.shortcuts.click }}</kbd>
      </span>
      <span class="text-body">{{ t.shortcuts.selectSeveral }}</span>
    </li>
  </ul>
</template>
