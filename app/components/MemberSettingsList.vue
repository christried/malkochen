<script setup lang="ts">
import type { BoardMemberView } from '~~/server/utils/boards'

// Board settings' Members (PRD story 62), the Owner first and marked. The
// Owner gets a button on everyone else's row, to hand over ownership or
// remove them (stories 67, 68); `manage` says which Member it was.
defineProps<{ members: BoardMemberView[], isOwner: boolean }>()
defineEmits<{ manage: [member: BoardMemberView] }>()
const t = useStrings()
</script>

<template>
  <ul
    class="flex flex-col gap-2"
    :aria-label="t.settings.members"
  >
    <li
      v-for="member in members"
      :key="member.id"
      class="flex min-h-[60px] items-center gap-3 rounded-field bg-surface-muted py-2 pl-4 pr-2"
    >
      <UserAvatar
        :name="member.name"
        :image="member.image"
        :size="36"
      />
      <span class="min-w-0 flex-1 truncate text-button">
        {{ member.name }}<span
          v-if="member.isYou"
          class="text-text-muted"
        > ({{ t.settings.you }})</span>
      </span>
      <span
        v-if="member.isOwner"
        class="shrink-0 rounded-chip bg-butter px-2.5 py-1 text-caption text-on-accent"
      ><span aria-hidden="true">👑 </span>{{ t.settings.owner }}</span>
      <button
        v-else-if="isOwner"
        type="button"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="t.settings.manageMember(member.name)"
        :data-tooltip="t.settings.manageMember(member.name)"
        aria-haspopup="dialog"
        @click="$emit('manage', member)"
      >
        <span
          aria-hidden="true"
          class="text-title-s leading-none"
        >⋯</span>
      </button>
    </li>
  </ul>
</template>
