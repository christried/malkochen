<script setup lang="ts">
import type { ChangelogSection } from '~~/shared/changelog'

// One Version's sections on the Changelog page (pages/changelog.vue), or
// those of "Gerade neu": each under its name in the viewer's language, its
// entries as a list.
defineProps<{ sections: ChangelogSection[] }>()
const t = useStrings()
</script>

<template>
  <div
    v-for="section in sections"
    :key="section.kind"
    class="flex flex-col gap-2"
  >
    <h3 class="section-heading">
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
