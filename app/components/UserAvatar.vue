<script setup lang="ts">
// A person's round picture: their Google photo, or their initial on one of the
// handoff's avatar colours (tokens.json color.avatar: [fill, ink], the same in
// both themes), picked from the name so a person always gets the same one.
const props = withDefaults(defineProps<{
  name: string
  image?: string | null
  size?: number
}>(), { image: null, size: 22 })

const AVATAR_COLORS = [
  ['#F7C85C', '#2B1E04'],
  ['#A9C9B1', '#12291A'],
  ['#DDB0F6', '#2D0F3F'],
  ['#A8BEE3', '#0F2340'],
] as const

const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || '?')
const colors = computed(() => {
  let hash = 0
  for (const char of props.name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!
})
const imageFailed = ref(false)
</script>

<template>
  <img
    v-if="image && !imageFailed"
    :src="image"
    alt=""
    class="shrink-0 rounded-full object-cover"
    :style="{ width: `${size}px`, height: `${size}px` }"
    referrerpolicy="no-referrer"
    @error="imageFailed = true"
  >
  <span
    v-else
    aria-hidden="true"
    class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.48)}px`, background: colors[0], color: colors[1] }"
  >{{ initial }}</span>
</template>
