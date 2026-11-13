import type { ComputedRef, Ref } from 'vue'
import type { ShoppingGroup as Group } from '~/board/shopping-list'
import { masonryColumns } from '~/utils/shopping-layout'

// The gap a Dish group keeps below itself on the desktop columns (gap-[18px]).
export const SHOPPING_GROUP_GAP = 18

// The desktop layout of the Shopping List's Dish groups (#536): two masonry
// columns. Each new Dish group goes into the shorter column. The column of
// each group is set when the set of Dish groups changes, from the groups'
// heights (measured with a ResizeObserver, so a group that has grown counts
// when the next group comes). Between changes a group stays where it is, so
// nothing jumps while lines are ticked.
//
// `dishGroups` are the Dish groups in list order, `visible` says whether the
// list shows (its heights are 0 while it is hidden, so the columns are worked
// out when it shows), and `root` is the element the groups are drawn in.
export function useShoppingMasonry(dishGroups: ComputedRef<Group[]>, visible: Ref<boolean>, root: Ref<HTMLElement | null>) {
  const column = ref(new Map<string | null, 0 | 1>())
  const columns = computed<[Group[], Group[]]>(() => {
    const cols: [Group[], Group[]] = [[], []]
    for (const g of dishGroups.value) cols[column.value.get(g.dishId) === 1 ? 1 : 0].push(g)
    return cols
  })
  const dishKeys = computed(() => dishGroups.value.map(g => g.dishId).join(','))
  const heights = new Map<string, number>()
  let observer: ResizeObserver | undefined
  // Not measured while the list is hidden: the columns wait for it to show.
  let stale = true
  function groupElement(id: string): HTMLElement | undefined {
    return root.value?.querySelector<HTMLElement>(`[data-shopping-group="${id}"]`) ?? undefined
  }
  function assignColumns() {
    if (!visible.value) {
      stale = true
      return
    }
    stale = false
    const ids = dishGroups.value.map(g => g.dishId!)
    const groupHeights = ids.map((id) => {
      const el = groupElement(id)
      if (el) observer?.observe(el)
      // Measured now, as far as the layout is; the observer's figure is kept
      // for a group that is not drawn at this moment.
      return el?.offsetHeight || heights.get(id) || 0
    })
    const picked = masonryColumns(groupHeights, SHOPPING_GROUP_GAP)
    column.value = new Map(ids.map((id, i) => [id, picked[i]!]))
  }
  watch(dishKeys, assignColumns, { flush: 'post' })
  // Coming to the list, the columns are worked out a frame later, when the
  // list has been laid out at its real size.
  watch(visible, (now) => {
    if (now && stale) requestAnimationFrame(assignColumns)
  }, { flush: 'post' })
  onMounted(() => {
    observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement
        const id = el.dataset.shoppingGroup
        // A hidden group measures 0: that is no height to keep.
        if (id && el.offsetHeight > 0) heights.set(id, el.offsetHeight)
      }
    })
    assignColumns()
  })
  onBeforeUnmount(() => observer?.disconnect())

  return { columns }
}
