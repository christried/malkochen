<script setup lang="ts">
// The Caption (CONTEXT.md, #393) under a Dish's title: the text its Source
// shows with the post, as plain text (links aren't clickable), folded to a
// few lines. "mehr" unfolds it and "weniger" folds it again; the toggle only
// shows when the folded text is cut short. Nobody edits it.
const props = defineProps<{ caption: string }>()
const t = useStrings()

const FOLDED_LINES = 4
const foldStyle = { display: '-webkit-box', WebkitLineClamp: FOLDED_LINES, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as const

const folded = ref(true)
const text = useTemplateRef<HTMLElement>('text')
// Whether the folded text is cut short. Once it is, the toggle stays while
// the Caption is unfolded.
const cut = ref(false)

function measure() {
  const el = text.value
  if (el && folded.value) cut.value = el.scrollHeight > el.clientHeight + 1
}

watch(() => props.caption, async () => {
  folded.value = true
  await nextTick()
  measure()
})

let observer: ResizeObserver | undefined
onMounted(() => {
  measure()
  // The width of the text changes the number of lines it takes.
  if (text.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure)
    observer.observe(text.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div
    class="flex flex-col items-start gap-2"
    data-caption
  >
    <p
      ref="text"
      class="whitespace-pre-line break-words text-body text-text"
      :style="folded ? foldStyle : undefined"
    >{{ caption }}</p>
    <button
      v-if="cut"
      type="button"
      class="rounded-pill text-small font-semibold text-text-muted underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      data-caption-toggle
      :aria-expanded="!folded"
      @click="folded = !folded"
    >
      {{ folded ? t.detail.captionMore : t.detail.captionLess }}
    </button>
  </div>
</template>
