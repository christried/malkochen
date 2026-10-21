<script setup lang="ts">
import { PERMISSIONS, VIEW_ONLY, type Permission, type Permissions } from '~~/shared/permissions'

// Board settings' Permissions (#340, #343): a switch for each, under
// `title`. The Owner switches a Member's, or the Default Permissions, and
// has "Nur ansehen" to switch all but commenting and voting off at once;
// `switched` says what to change, and which control is busy until it's
// saved (`busy`). `readonly`: a Member's own, to see only.
defineProps<{
  title: string
  permissions: Permissions
  busy: Permission | 'viewOnly' | null
  readonly?: boolean
  // Below the switches.
  hint?: string
}>()
const emit = defineEmits<{ switched: [changes: Partial<Permissions>, busy: Permission | 'viewOnly'] }>()
const t = useStrings()
const titleId = useId()
const viewOnlyHintId = useId()

function viewOnly() {
  emit('switched', VIEW_ONLY, 'viewOnly')
}
</script>

<template>
  <div
    role="group"
    :aria-labelledby="titleId"
    class="flex flex-col gap-3 rounded-card bg-surface-muted p-4"
  >
    <p
      :id="titleId"
      class="text-button"
    >
      {{ title }}
    </p>
    <SettingsSwitch
      v-for="permission in PERMISSIONS"
      :key="permission"
      :label="t.settings.permission[permission].label"
      :hint="t.settings.permission[permission].hint"
      :checked="permissions[permission]"
      :busy="busy === permission"
      :disabled="readonly || busy !== null"
      @toggle="emit('switched', { [permission]: !permissions[permission] }, permission)"
    />
    <div
      v-if="!readonly"
      class="flex flex-col items-start gap-1.5 border-t border-line pt-3"
    >
      <button
        type="button"
        class="rounded-pill bg-surface px-4 py-2.5 text-button text-text transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-focus"
        :aria-describedby="viewOnlyHintId"
        :aria-busy="busy === 'viewOnly'"
        :disabled="busy !== null"
        @click="viewOnly"
      >
        {{ t.settings.viewOnly }}
      </button>
      <p
        :id="viewOnlyHintId"
        class="text-small text-text-muted"
      >
        {{ t.settings.viewOnlyHint }}
      </p>
    </div>
    <p
      v-if="hint"
      class="text-small text-text-muted"
    >
      {{ hint }}
    </p>
  </div>
</template>
