// The modals open on top of each other (sheets, dialogs, the Dish detail),
// in the order they opened. One that another opened over is `covered`: it
// steps back (handoff "Sheet open / close": stacked, the parent scales to
// .96 and dims 20%).
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
  return computed(() => stack.value.includes(id) && stack.value.at(-1) !== id)
}
