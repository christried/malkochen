<script setup lang="ts">
// The Shopping List with nothing on it yet (#536): Topfbert pointing at the
// field above, and a line about where items come from.
const t = useStrings()
</script>

<template>
  <div
    class="empty-list mt-5 flex items-center gap-3 rounded-card bg-surface py-3.5 pl-2.5 pr-4 shadow-card desktop:gap-4 desktop:py-5 desktop:pl-4 desktop:pr-6"
    data-testid="empty-shopping-list"
  >
    <TopfbertIdle
      mood="pointing"
      class="w-[78px] shrink-0 desktop:w-[100px]"
    />
    <div class="min-w-0">
      <h3 class="font-display text-[21px] font-medium leading-tight">
        {{ t.shopping.emptyTitle }}
      </h3>
      <p class="mt-1 text-[14px] font-medium leading-snug text-text-muted">
        {{ t.shopping.emptyText }}
      </p>
    </div>
  </div>
</template>

<style scoped>
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
