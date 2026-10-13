<script setup lang="ts">
// "Impressum" and "Datenschutz" side by side (utils/legal.ts), small and
// muted: in the sign-in screen's footer, at the end of the user menu and, on
// phones, of the Board switcher. Each opens in a new tab, so the app stays
// where it was. `menu`: as rows of a menu (UserMenu), which moves focus
// between them itself.
defineProps<{ menu?: boolean }>()
const t = useStrings()
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-2 text-small text-text-muted">
    <a
      v-for="link in LEGAL_LINKS"
      :key="link.label"
      :href="link.href"
      target="_blank"
      rel="noopener noreferrer"
      :role="menu ? 'menuitem' : undefined"
      :tabindex="menu ? -1 : undefined"
      class="inline-flex min-h-11 items-center rounded-chip px-2 underline-offset-4 transition-colors duration-fade ease-fade hover:text-text hover:underline focus-visible:text-text focus-visible:outline-2 focus-visible:outline-focus"
    >{{ t.legal[link.label] }}</a>
  </div>
</template>
