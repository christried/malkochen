<script setup lang="ts">
import type { Placeholder } from '~~/shared/placeholders'
import type { ClipMotion } from '~/utils/motion'

// A Dish's image, filling its frame: the stored copy of the Source image, or
// the Placeholder Image. A stored image that fails to load falls back to the
// Placeholder. On a server-rendered page it may have failed before hydration,
// when no @error listener was attached yet, so mounting checks too.
// `motion` plays the Placeholder's loop, on and on or once (then `ended`);
// a stored image stays as it is.
const props = defineProps<{
  imageUrl: string | null
  placeholder: Placeholder
  lazy?: boolean
  motion?: ClipMotion
}>()
defineEmits<{ ended: [] }>()

const imageBroken = ref(false)
const image = useTemplateRef<HTMLImageElement>('image')
watch(() => props.imageUrl, () => imageBroken.value = false)
onMounted(() => {
  if (image.value?.complete && image.value.naturalWidth === 0) imageBroken.value = true
})
</script>

<template>
  <img
    v-if="imageUrl && !imageBroken"
    ref="image"
    :src="imageUrl"
    alt=""
    class="h-full w-full object-cover"
    :loading="lazy ? 'lazy' : undefined"
    data-dish-image
    @error="imageBroken = true"
  >
  <PlaceholderClip
    v-else
    :placeholder="placeholder"
    :motion="motion"
    @ended="$emit('ended')"
  />
</template>
