<script setup lang="ts">
import type { SourceKind } from '~~/server/source-lookup'
import { badgeKind } from '~~/shared/source-badge'

// The handoff's SourceBadge, glass variant (it sits on the card's image): a
// coloured dot and the Source's name. `dotOnly`: its dot-only variant from
// desktop width (handoff "dot-only (desktop card)"), where a lane's card
// thumbnail is too narrow for the name; the name stays for screen readers,
// and under a mouse the Tooltip says it. `chip`: its chip variant (handoff
// "chip (on surface-muted)"), for a badge on the page instead of on an image,
// like the one above the Dish detail's title.
const props = defineProps<{ kind: SourceKind, dotOnly?: boolean, chip?: boolean }>()
const t = useStrings()
const badge = computed(() => badgeKind(props.kind))
</script>

<template>
  <span
    class="inline-flex items-center rounded-chip text-caption text-text"
    :class="[chip ? 'gap-1.5 bg-surface-muted px-2.5 py-1.5' : 'gap-1 bg-glass px-1.5 py-0.5 backdrop-blur-sm', { 'desktop:p-1': dotOnly }]"
    :data-tooltip="dotOnly ? t.sources[badge] : undefined"
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
