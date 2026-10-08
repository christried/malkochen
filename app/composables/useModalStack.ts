import type { InjectionKey } from 'vue'

// The modals open on top of each other (sheets, dialogs, the Dish detail),
// in the order they opened. One that another opened over is `covered`: it
// steps back (handoff "Sheet open / close": stacked, the parent scales to
// .96 and dims 20%). What's inside a modal can ask whether it is covered
// (useCoveredByModal).
const coveredKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol('covered-by-modal')

export function useModalStack(open: Ref<boolean> | (() => boolean)) {
  const stack = useState<string[]>('modal-stack', () => [])
  const id = useId()
  watch(open, (isOpen) => {
    stack.value = stack.value.filter(other => other !== id)
    if (isOpen) stack.value.push(id)
  }, { immediate: import.meta.client })
  onBeforeUnmount(() => {
    stack.value = stack.value.filter(other => other !== id)
  })
  const covered = computed(() => stack.value.includes(id) && stack.value.at(-1) !== id)
  provide(coveredKey, covered)
  return covered
}

// Whether the modal this is in has another opened over it; never, outside
// a modal.
export function useCoveredByModal(): Readonly<Ref<boolean>> {
  return inject(coveredKey, computed(() => false))
}

// Whether any modal is open (a sheet, a dialog, the Dish detail).
export function useAnyModalOpen(): Readonly<Ref<boolean>> {
  const stack = useState<string[]>('modal-stack', () => [])
  return computed(() => stack.value.length > 0)
}
