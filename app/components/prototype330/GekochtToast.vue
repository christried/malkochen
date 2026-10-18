<script setup lang="ts">
// PROTOTYPE #330: throwaway, never merge. The Gekocht toast of #318 (stories
// 20 to 22): "Gekocht ✓", 👍 and 👎, "Kommentieren" and "Rückgängig", in
// the toast's inverse colours. A Vote stays in the toast (it can be changed
// there), the other two close it.
//   A, one pill like today's: the parts wrap onto a second row when they
//      don't fit (at 360px they don't).
//   B, two rows: "Gekocht ✓" and "Rückgängig" on top, "Wie war's?" with
//      👍 👎 and "Kommentieren" below.
//   C, one row: "Kommentieren" as a speech bubble.
const props = defineProps<{ toast: Toast, variant: string }>()
const emit = defineEmits<{ act: [action: ToastAction], bar: [el: HTMLElement | null] }>()

const vote = useP330MyVote(() => props.toast.p330Gekocht!.dishId)
function pick(up: boolean) {
  const wanted = up ? 'up' : 'down'
  vote.value = vote.value === wanted ? null : wanted
}
const comment = computed(() => props.toast.actions?.find(a => a.label === 'Kommentieren'))
const undo = computed(() => props.toast.actions?.find(a => a.label !== 'Kommentieren'))

const barEl = useTemplateRef<HTMLElement>('bar')
watch(barEl, el => emit('bar', el), { immediate: true, flush: 'post' })
onBeforeUnmount(() => emit('bar', null))

const link = 'shrink-0 rounded-pill py-1.5 text-button text-on-inverse underline decoration-2 underline-offset-4 transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus'
</script>

<template>
  <div
    class="pointer-events-auto relative overflow-hidden bg-inverse text-small text-on-inverse shadow-fab"
    :class="{
      'flex flex-wrap items-center justify-end gap-x-1 gap-y-1 rounded-[26px] py-2.5 pl-4 pr-2': variant === 'A',
      'flex flex-col gap-2 rounded-dialog px-4 pb-3.5 pt-3': variant === 'B',
      'flex items-center gap-1 rounded-pill py-2 pl-4 pr-2': variant === 'C',
    }"
    data-toast
    :data-p330-toast="variant"
  >
    <template v-if="variant === 'A'">
      <p class="mr-auto shrink-0 whitespace-nowrap">
        {{ toast.text }}
      </p>
      <span class="flex items-center gap-1">
        <Prototype330VoteButtons
          :vote="vote"
          :size="36"
          @pick="pick"
        />
        <button
          v-if="comment"
          type="button"
          :class="link"
          class="px-2"
          @click="emit('act', comment)"
        >
          Kommentieren
        </button>
        <button
          v-if="undo"
          type="button"
          :class="link"
          class="px-2"
          @click="emit('act', undo)"
        >
          {{ undo.label }}
        </button>
      </span>
    </template>

    <template v-else-if="variant === 'B'">
      <div class="flex items-center justify-between gap-3">
        <p class="font-semibold">
          {{ toast.text }}
        </p>
        <button
          v-if="undo"
          type="button"
          :class="link"
          class="-mr-1 px-1.5"
          @click="emit('act', undo)"
        >
          {{ undo.label }}
        </button>
      </div>
      <div class="flex items-center gap-2">
        <span class="mr-0.5 whitespace-nowrap text-on-inverse/70">Wie war’s?</span>
        <Prototype330VoteButtons
          :vote="vote"
          :size="38"
          @pick="pick"
        />
        <button
          v-if="comment"
          type="button"
          class="ml-auto flex h-10 shrink-0 items-center gap-1.5 rounded-pill bg-on-inverse/12 px-3 text-button transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          @click="emit('act', comment)"
        >
          <Prototype330Icon
            name="bubble"
            :size="16"
          />
          Kommentieren
        </button>
      </div>
    </template>

    <template v-else>
      <p class="mr-auto shrink-0 whitespace-nowrap pr-1">
        {{ toast.text }}
      </p>
      <Prototype330VoteButtons
        :vote="vote"
        :size="38"
        @pick="pick"
      />
      <button
        v-if="comment"
        type="button"
        class="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-on-inverse/12 transition-transform duration-tap ease-tap active:scale-90 focus-visible:outline-2 focus-visible:outline-focus"
        aria-label="Kommentieren"
        data-tooltip="Kommentieren"
        @click="emit('act', comment)"
      >
        <Prototype330Icon
          name="bubble"
          :size="18"
        />
      </button>
      <button
        v-if="undo"
        type="button"
        :class="link"
        class="px-2"
        @click="emit('act', undo)"
      >
        {{ undo.label }}
      </button>
    </template>

    <span
      ref="bar"
      aria-hidden="true"
      class="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-on-inverse/40"
    />
  </div>
</template>
