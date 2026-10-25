<script setup lang="ts">
import type { ChangelogSection } from '~~/shared/changelog'

// One Version's sections on the Changelog page (pages/changelog.vue), or
// those of "Gerade neu": each under its name in the viewer's language, its
// entries as a list.
// The coloured bar before a section's name is the Accent of its kind.
defineProps<{ sections: ChangelogSection[] }>()
const t = useStrings()
const MARK: Record<ChangelogSection['kind'], string> = {
  added: 'bg-butter',
  changed: 'bg-sky',
  removed: 'bg-carrot',
  fixed: 'bg-sage',
  security: 'bg-orchid',
}
</script>

<template>
  <div
    v-for="section in sections"
    :key="section.kind"
    class="flex flex-col gap-2"
  >
    <h3 class="flex items-center gap-2 font-display text-title-s">
      <span
        aria-hidden="true"
        class="h-5 w-1.5 rounded-full"
        :class="MARK[section.kind]"
      />
      {{ t.changelog.sections[section.kind] }}
    </h3>
    <ul class="flex list-disc flex-col gap-1.5 pl-5 text-body">
      <li
        v-for="entry in section.entries"
        :key="entry"
      >
        {{ entry }}
      </li>
    </ul>
  </div>
</template>
