<script setup lang="ts">
// The Board's search field, focused as it opens (and by `focus`, as "/"
// does when it is open already). ✕ or Escape closes it.
const query = defineModel<string>({ required: true })
defineEmits<{ close: [] }>()
const t = useStrings()

const field = useTemplateRef<HTMLInputElement>('field')
onMounted(() => field.value?.focus())
defineExpose({ focus: () => field.value?.focus() })
</script>

<template>
  <div
    role="search"
    class="flex items-center gap-2"
    @keydown.esc="$emit('close')"
  >
    <div class="flex min-w-0 flex-1 items-center gap-2 rounded-pill bg-surface px-4 text-text-muted shadow-card focus-within:outline-2 focus-within:outline-focus">
      <AppIcon name="search" />
      <input
        ref="field"
        v-model="query"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        class="search-field min-w-0 flex-1 bg-transparent py-3 text-body text-text outline-none placeholder:text-text-muted"
        :aria-label="t.search.label"
        :placeholder="t.search.prompt"
      >
    </div>
    <RoundButton
      :aria-label="t.search.close"
      @click="$emit('close')"
    >
      <AppIcon name="close" />
    </RoundButton>
  </div>
</template>

<style scoped>
/* The browser's own clear button is left out; ✕ closes the search. */
.search-field::-webkit-search-cancel-button {
  appearance: none;
}
</style>
