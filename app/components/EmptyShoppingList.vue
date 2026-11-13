<script setup lang="ts">
// The Shopping List with nothing on it yet (#536): Topfbert winking, a line
// about how things get on the list, and the way in. On a phone a button that
// opens the add bar (as the FAB does); on desktop the add field itself, which
// the list puts in the slot.
const t = useStrings()
const emit = defineEmits<{ write: [] }>()
</script>

<template>
  <div
    class="empty-list mx-auto mt-5 rounded-card bg-surface pb-4 pl-3 pr-4 pt-3.5 shadow-card desktop:mt-10 desktop:w-[520px] desktop:max-w-full desktop:p-6 desktop:shadow-dialog"
    data-testid="empty-shopping-list"
  >
    <div class="flex items-center gap-3 desktop:gap-4">
      <TopfbertIdle
        mood="wink"
        class="w-[78px] shrink-0 desktop:w-[100px]"
      />
      <div class="min-w-0">
        <h3 class="font-display text-[22px] font-medium leading-tight">
          {{ t.shopping.emptyTitle }}
        </h3>
        <p class="mt-1 text-[14px] font-medium leading-snug text-text-muted">
          {{ t.shopping.emptyHow }}
        </p>
      </div>
    </div>

    <ul class="mt-4 flex flex-col gap-3">
      <li class="flex items-center gap-3 text-[15px] font-medium leading-snug">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted">
          <AppIcon
            name="bag-plus"
            :size="18"
          />
        </span>
        {{ t.shopping.emptyFromDish }}
      </li>
      <li class="flex items-center gap-3 text-[15px] font-medium leading-snug">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><rect
            x="3.5"
            y="5"
            width="17"
            height="15.5"
            rx="2.5"
          /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
        </span>
        {{ t.shopping.emptyFromWeek }}
      </li>
      <li class="flex items-center gap-3 text-[15px] font-medium leading-snug">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted">
          <AppIcon
            name="pencil"
            :size="18"
          />
        </span>
        {{ t.shopping.emptyTyped }}
      </li>
    </ul>

    <!-- Phone: the add bar, as the FAB opens it. Desktop: the field itself. -->
    <button
      type="button"
      class="mt-5 flex h-11 w-full items-center justify-center rounded-pill bg-inverse px-5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus desktop:hidden"
      @click="emit('write')"
    >
      {{ t.shopping.emptyWrite }}
    </button>
    <div class="mt-5 hidden desktop:block">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* The card pops in once, after the Topfbert's arrival (460ms, +200ms). */
.empty-list {
  animation: pop-in var(--dur-pop) var(--ease-pop) 200ms backwards;
}
@keyframes pop-in {
  from {
    opacity: 0;
    scale: .92;
  }
}
@media (prefers-reduced-motion: reduce) {
  .empty-list {
    animation: none;
  }
}
</style>
