<script setup lang="ts">
import type { Placeholder } from '~~/shared/placeholders'
import type { ClipMotion } from '~/utils/motion'

// A Placeholder Image with its loop (handoff illustrations.json): the still,
// and the same drawing animated over it as `motion` asks, in code (SvgLoop).
defineProps<{ placeholder: Placeholder, motion?: ClipMotion }>()
defineEmits<{ ended: [] }>()
</script>

<template>
  <SvgLoop
    :src="`/placeholders/${placeholder}`"
    :play="!!motion"
    :loop="motion !== 'once'"
    data-placeholder-clip
    @ended="$emit('ended')"
  >
    <PlaceholderStill :placeholder="placeholder" />
  </SvgLoop>
</template>
