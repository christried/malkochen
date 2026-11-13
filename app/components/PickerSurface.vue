<script setup lang="ts">
// Where a picker of the Week Plan opens (handoff BottomSheet r14): a sheet on
// phones and tablets (AppSheet, a centred dialog from 768px), from 1200px a
// popover anchored to the button that opened it (AnchoredPanel). `tall`: the
// picker brings its own header and fills the sheet (the Dish picker); else
// the title and a close button are drawn here, in both. `header` (a slot)
// replaces the title in the popover and goes above the contents in the sheet,
// where AppSheet still draws the title and the close button. `above`: the
// popover rises from the button when there is room above it.
const open = defineModel<boolean>('open', { required: true })
const props = withDefaults(defineProps<{
  title: string
  closeLabel: string
  anchor: HTMLElement | null
  tall?: boolean
  width?: number
  align?: 'start' | 'end'
  above?: boolean
}>(), { tall: false, width: 320, align: 'start', above: false })

const wide = useMediaQuery('(min-width: 1200px)')
const popover = computed(() => wide.value && !!props.anchor)
</script>

<template>
  <AnchoredPanel
    v-if="popover"
    v-model:open="open"
    :anchor="anchor"
    :label="title"
    :width="width"
    :align="align"
    :above="above"
  >
    <div
      class="flex max-h-[inherit] min-h-0 flex-col"
    >
      <div
        v-if="!tall"
        class="flex shrink-0 items-center gap-3 px-5 pb-1 pt-4"
      >
        <div class="min-w-0 flex-1">
          <slot
            name="header"
            :popover="true"
          >
            <h2 class="font-display text-title-s">
              {{ title }}
            </h2>
          </slot>
        </div>
        <button
          type="button"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          :aria-label="closeLabel"
          @click="open = false"
        >
          <AppIcon
            name="close"
            :size="16"
          />
        </button>
      </div>
      <div :class="tall ? 'flex min-h-0 flex-1 flex-col' : 'px-5 pb-5'">
        <slot :popover="true" />
      </div>
    </div>
  </AnchoredPanel>
  <AppSheet
    v-else
    v-model:open="open"
    :title="title"
    :close-label="closeLabel"
    :tall="tall"
  >
    <div
      v-if="$slots.header"
      class="mt-4"
    >
      <slot
        name="header"
        :popover="false"
      />
    </div>
    <slot :popover="false" />
  </AppSheet>
</template>
