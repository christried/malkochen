<script setup lang="ts">
// The handoff's BottomSheet on phones, which becomes a Dialog at ≥768px. A
// native modal <dialog>: the browser traps focus, makes the page behind inert
// and closes it on Escape. Tapping the scrim closes it too.
const open = defineModel<boolean>('open', { required: true })
defineProps<{ title: string, closeLabel: string }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleId = useId()

watch(open, (isOpen) => {
  if (isOpen && !dialog.value?.open) dialog.value?.showModal()
  if (!isOpen && dialog.value?.open) dialog.value.close()
}, { flush: 'post' })
</script>

<template>
  <dialog
    ref="dialog"
    class="sheet bg-surface p-0 text-text shadow-sheet tablet:shadow-dialog"
    :aria-labelledby="titleId"
    @close="open = false"
    @click.self="open = false"
  >
    <div class="px-5 pb-6 pt-3 tablet:px-7 tablet:pt-6">
      <div
        aria-hidden="true"
        class="mx-auto mb-3 h-1.5 w-10 rounded-pill bg-line-strong tablet:hidden"
      />
      <div class="flex items-center justify-between gap-4">
        <h2
          :id="titleId"
          class="font-display text-title-m"
        >
          {{ title }}
        </h2>
        <button
          type="button"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          :aria-label="closeLabel"
          @click="open = false"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            aria-hidden="true"
          ><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <slot />
    </div>
  </dialog>
</template>

<style scoped>
/* Phone: a tall sheet from the bottom edge (handoff: top at 58px). */
.sheet {
  margin: auto 0 0;
  width: 100%;
  max-width: 100%;
  max-height: calc(100dvh - 58px);
  border: 0;
  border-radius: var(--radius-sheet);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.sheet::backdrop {
  background: var(--color-scrim);
}
.sheet[open] {
  animation: sheet-in var(--dur-sheet) var(--ease-sheet);
}
.sheet[open]::backdrop {
  animation: scrim-in var(--dur-fade) var(--ease-fade);
}

/* Tablet and up: a centred dialog. */
@media (min-width: 768px) {
  .sheet {
    margin: auto;
    width: min(480px, calc(100% - 48px));
    max-height: calc(100dvh - 48px);
    border-radius: var(--radius-dialog);
  }
  .sheet[open] {
    animation: dialog-in var(--dur-pop) var(--ease-pop);
  }
}

@keyframes sheet-in {
  from { transform: translateY(100%); }
}
@keyframes dialog-in {
  from { transform: scale(.92); opacity: 0; }
}
@keyframes scrim-in {
  from { opacity: 0; }
}
</style>
