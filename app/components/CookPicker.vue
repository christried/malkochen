<script setup lang="ts">
import type { BoardMemberView } from '~~/server/utils/boards'

// The cook picker (handoff CookPicker): who cooks a Planned Dish, from the
// Board's Members (their Profile Pictures and Usernames, "du" on your own
// row), and "Offen lassen" to clear it. The one set shows a sage check.
// Picking closes the picker (WeekPlan). A radio group (WAI-ARIA APG): the
// arrows go round the rows, Enter or Space choose.
const props = defineProps<{
  // The line under the sheet's title: the Dish and its day.
  subtitle: string
  members: BoardMemberView[]
  cookId: string | null
}>()
const emit = defineEmits<{ pick: [memberId: string | null] }>()
const t = useStrings()
const group = useTemplateRef<HTMLElement>('group')

// The one set takes the Tab stop; with nobody set, "Offen lassen" does.
const stop = computed(() => props.members.some(m => m.id === props.cookId) ? props.cookId : null)

const rows = () => [...group.value?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []]
function onKeydown(event: KeyboardEvent) {
  const all = rows()
  const current = all.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? (current + 1) % all.length
    : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? (current - 1 + all.length) % all.length
      : event.key === 'Home' ? 0
        : event.key === 'End' ? all.length - 1 : -1
  if (next === -1) return
  event.preventDefault()
  all[next]?.focus()
}
</script>

<template>
  <div data-testid="cook-picker">
    <p class="mt-1 truncate text-body text-text-muted">
      {{ subtitle }}
    </p>
    <div
      ref="group"
      role="radiogroup"
      :aria-label="t.week.whoCooks"
      class="mt-3 flex flex-col"
      @keydown="onKeydown"
    >
      <button
        v-for="member in members"
        :key="member.id"
        type="button"
        role="radio"
        class="row"
        :aria-checked="member.id === cookId"
        :tabindex="stop === member.id ? 0 : -1"
        :data-cook-member="member.id"
        @click="emit('pick', member.id)"
      >
        <UserAvatar
          :name="member.name"
          :image="member.image"
          :size="36"
        />
        <span class="min-w-0 truncate text-[15.5px] font-semibold">{{ member.name }}</span>
        <span
          v-if="member.isYou"
          class="shrink-0 text-[15.5px] font-medium text-text-muted"
        >{{ t.week.you }}</span>
        <span class="flex-1" />
        <span
          v-if="member.id === cookId"
          class="check"
        >
          <AppIcon
            name="check"
            :size="14"
          />
        </span>
      </button>
      <button
        type="button"
        role="radio"
        class="row"
        :aria-checked="cookId === null"
        :tabindex="stop === null ? 0 : -1"
        data-cook-none
        @click="emit('pick', null)"
      >
        <span class="none" />
        <span class="text-[15.5px] font-semibold">{{ t.week.leaveOpen }}</span>
        <span class="flex-1" />
        <span
          v-if="cookId === null"
          class="check"
        >
          <AppIcon
            name="check"
            :size="14"
          />
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 4px;
  border-radius: 16px;
  text-align: left;
  transition: scale var(--dur-tap) var(--ease-tap);
}
.row:active {
  scale: .98;
}
.row:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: -2px;
}
.none {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: 2px dashed var(--color-line-strong);
  border-radius: 50%;
}
.check {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--color-sage);
  color: var(--color-sage-ink);
}
@media (prefers-reduced-motion: reduce) {
  .row {
    transition: none;
  }
  .row:active {
    scale: none;
  }
}
</style>
