<script setup lang="ts">
import type { Placeholder } from '~~/shared/placeholders'
import type { ClipMotion } from '~/utils/motion'

// A Placeholder Image with its loop (handoff REMOTION.md "placeholder-*"):
// the still, and the clip played over it as `motion` asks.
defineProps<{ placeholder: Placeholder, motion?: ClipMotion }>()
defineEmits<{ ended: [] }>()
</script>

<template>
  <MotionClip
    :src="`/placeholders/${placeholder}`"
    :play="!!motion"
    :loop="motion !== 'once'"
    data-placeholder-clip
    @ended="$emit('ended')"
  >
    <PlaceholderStill :placeholder="placeholder" />
  </MotionClip>
</template>
