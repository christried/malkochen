<script setup lang="ts">
import type { SourceKind } from '~~/server/source-lookup'
import { badgeKind } from '~~/shared/source-badge'

// The handoff's SourceBadge, glass variant (it sits on the card's image): a
// coloured dot and the Source's name. `dotOnly`: its dot-only variant from
// desktop width (handoff "dot-only (desktop card)"), where a lane's card
// thumbnail is too narrow for the name; the name stays for screen readers.
const props = defineProps<{ kind: SourceKind, dotOnly?: boolean }>()
const t = useStrings()
const badge = computed(() => badgeKind(props.kind))
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-chip bg-glass px-1.5 py-0.5 text-caption text-text backdrop-blur-sm"
    :class="{ 'desktop:p-1': dotOnly }"
    data-source-badge
  >
    <span
      aria-hidden="true"
      class="source-dot h-2 w-2 shrink-0 rounded-full"
      :data-source="badge"
    />
    <span
      :class="{ 'desktop:sr-only': dotOnly }"
      data-source-name
    >{{ t.sources[badge] }}</span>
  </span>
</template>
