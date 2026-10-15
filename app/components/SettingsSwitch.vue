<script setup lang="ts">
// A switch row in your settings (push notifications, the Email Digest): the
// whole row is the switch, its name and what it does are its text.
defineProps<{
  label: string
  hint: string
  checked: boolean
  // Being checked or turned: announced, and not pressable meanwhile.
  busy: boolean
  disabled: boolean
}>()
defineEmits<{ toggle: [] }>()

const labelId = useId()
const hintId = useId()
</script>

<template>
  <button
    type="button"
    role="switch"
    class="group flex items-center justify-between gap-4 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus disabled:cursor-default"
    :aria-checked="checked"
    :aria-labelledby="labelId"
    :aria-describedby="hintId"
    :aria-busy="busy"
    :disabled="disabled"
    @click="$emit('toggle')"
  >
    <span class="flex min-w-0 flex-col gap-1">
      <span
        :id="labelId"
        class="text-body text-text"
      >{{ label }}</span>
      <span
        :id="hintId"
        class="text-small text-text-muted"
      >{{ hint }}</span>
    </span>
    <span
      aria-hidden="true"
      class="relative h-7 w-12 shrink-0 rounded-pill transition-colors duration-fade ease-fade group-disabled:opacity-60"
      :class="checked ? 'bg-inverse' : 'bg-line'"
    >
      <span
        class="knob absolute top-1 left-1 size-5 rounded-full bg-surface shadow-sm"
        :class="{ on: checked }"
      />
    </span>
  </button>
</template>

<style scoped>
/* The knob slides over when it is turned on. Reduced motion: it moves at
   once. */
.knob {
  transition: translate 240ms var(--ease-pop);
}
.knob.on {
  translate: 1.25rem 0;
}
@media (prefers-reduced-motion: reduce) {
  .knob {
    transition: none;
  }
}
</style>
