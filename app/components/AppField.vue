<script setup lang="ts">
// A labelled field in the handoff's label style 5b (components.json → Input):
// the label sits in the field's border, in a notch. The notch is a hidden
// legend in a fieldset that draws the border, so it opens on any
// background; the label readers get is the real <label> on top of it. The
// slot holds the control (input, select or textarea), or a `.field-row`
// around one; its look and the states are in main.css (`.field`). An
// aria-invalid control shows the error state.
defineProps<{
  label: string
  // The control's id, for the label.
  controlId: string
  // The link field once its lookup found something: a sage border.
  valid?: boolean
}>()
</script>

<template>
  <div
    class="field"
    :data-valid="valid || undefined"
  >
    <slot />
    <fieldset aria-hidden="true">
      <legend>{{ label }}</legend>
    </fieldset>
    <label :for="controlId">{{ label }}</label>
  </div>
</template>
