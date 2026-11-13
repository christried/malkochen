<script setup lang="ts">
import type { ShoppingEntry } from '~/board/shopping-list'

// One line of the Shopping List (#536). A tap anywhere on the row ticks it
// off (crossed out, at the bottom of its group) or back on. The pencil changes
// its text in place, the cross removes it. Lines not sent yet are marked
// "Noch nicht gesendet". While the line is being changed, ShoppingItemInput's
// edit field stands in for the row. The root is the `li`, so the group's
// TransitionGroup animates the line itself.
defineProps<{
  entry: ShoppingEntry
  editing: boolean
}>()
const emit = defineEmits<{
  tick: []
  edit: []
  save: [text: string]
  cancel: []
  remove: []
}>()

const t = useStrings()
</script>

<template>
  <li
    class="line flex items-center gap-1 rounded-[14px]"
    :class="{ ticked: entry.ticked }"
    :data-shopping-item="entry.id"
    :data-ticked="entry.ticked || undefined"
  >
    <ShoppingItemInput
      v-if="editing"
      variant="edit"
      :text="entry.text"
      @save="text => emit('save', text)"
      @cancel="emit('cancel')"
    />
    <template v-else>
      <button
        type="button"
        role="checkbox"
        :aria-checked="entry.ticked"
        class="row flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-[14px] px-2 py-2 text-left transition-transform duration-tap ease-tap active:scale-[.98] focus-visible:outline-2 focus-visible:outline-focus"
        data-shopping-tick
        @click="emit('tick')"
      >
        <span
          class="box flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2"
          :class="entry.ticked ? 'border-transparent bg-inverse text-on-inverse' : 'border-text-muted'"
          aria-hidden="true"
        >
          <AppIcon
            v-if="entry.ticked"
            name="check"
            :size="16"
          />
        </span>
        <span class="min-w-0 flex-1">
          <span
            class="text block break-words text-body leading-snug"
            :class="entry.ticked ? 'text-text-muted line-through' : ''"
          >{{ entry.text }}</span>
          <span
            v-if="entry.unsent"
            class="mt-0.5 flex items-center gap-1 text-[13px] text-text-muted"
            data-unsent
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              class="shrink-0"
            ><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5 4 4 0 0 1 17.5 18z" /></svg>
            {{ t.unsent.notSent }}
          </span>
        </span>
      </button>
      <button
        type="button"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="t.shopping.edit(entry.text)"
        data-shopping-change
        @click="emit('edit')"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        ><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
      </button>
      <button
        type="button"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="t.shopping.remove(entry.text)"
        data-shopping-remove
        @click="emit('remove')"
      >
        <AppIcon name="close" />
      </button>
    </template>
  </li>
</template>

<style scoped>
.box {
  transition: background-color var(--dur-fade) var(--ease-fade), border-color var(--dur-fade) var(--ease-fade);
}
</style>
