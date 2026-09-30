<script setup lang="ts">
import type { SourceKind } from '~~/server/source-lookup'
import { badgeKind } from '~~/shared/source-badge'

// The handoff's SourceBadge, glass variant (it sits on the card's image): a
// coloured dot and the Source's name.
const props = defineProps<{ kind: SourceKind }>()
const t = useStrings()
const badge = computed(() => badgeKind(props.kind))
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-chip bg-glass px-1.5 py-0.5 text-caption text-text backdrop-blur-sm"
    data-source-badge
  >
    <span
      aria-hidden="true"
      class="source-dot h-2 w-2 shrink-0 rounded-full"
      :data-source="badge"
    />
    {{ t.sources[badge] }}
  </span>
</template>
