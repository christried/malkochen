<script setup lang="ts">
// A group of changes that need a connection (#458): while malkochen can't be
// reached (useConnection), its buttons and fields are disabled and greyed
// out, and "Geht nur mit Netz" says why above them (`note`: false where a
// note elsewhere says it, or there's no room). No box of its own, so it
// sits in any layout. `allowed`: whether it is allowed after all (Comments
// offline, on a Dish whose History has loaded), in place of asking whether
// malkochen answers.
const props = withDefaults(defineProps<{ note?: boolean, allowed?: boolean }>(), { note: true, allowed: undefined })
const t = useStrings()
const { mayChange } = useConnection()
const may = computed(() => props.allowed ?? mayChange.value)
</script>

<template>
  <p
    v-if="note && !may"
    class="text-small text-text-muted"
    data-needs-net-note
  >
    {{ t.offline.needsNet }}
  </p>
  <fieldset
    class="needs-net contents"
    :disabled="!may"
  >
    <slot />
  </fieldset>
</template>

<style scoped>
.needs-net:disabled > :deep(*) {
  opacity: .45;
  cursor: not-allowed;
}
</style>
