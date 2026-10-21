<script setup lang="ts">
import type { BoardView } from '~~/server/utils/boards'
import type { Me } from '~~/server/utils/people'
import { dishOnBoard } from '~~/shared/board'
import { startTour, tourAfter, tourBrowser, tourStep, TOUR_VERSION, type Tour, type TourButton, type TourEvent, type TourTarget } from '~/tour/tour'

// The Tour (CONTEXT.md, #298) on the Board: feeds the Tour module what the
// Board is like and what the user chooses, and draws its steps (TourLayer).
// It never asks for what the user's Permissions on the Board don't allow
// (#343). It starts by itself for a user who hasn't seen this version yet, once the
// Board is idle (`idle`: nothing open over it, no search, no selection, no
// drag) and the splash has gone, unless the Board opened to add a shared
// link (`autoStart` false), and starts again from Your Settings (`start`).
// Finishing or skipping it records the version, for every device, and says
// where to start it again (`ended`). A reload halfway through records
// nothing, so it starts over next time. In the browser tests it never starts
// by itself, unless the test page turned that on (window.e2eTourAutoStart).
// It follows Add Dish (`adding`): opened, closed, and closed by "Ohne
// Gericht weiter"; and is told of the Dish saved there (`dishAdded`).
// `addingTourDish`: the Dish saved now is the Tour's, which notifies nobody.
// Add Dish says it was added before it closes, so the Tour is at the new
// card by then and the closing doesn't take it back.
// It follows the Tour's Dish on the Board, whichever way it moves (dragged,
// through its ⋯ menu, by someone else): the Column it's in, or gone; its ⋯
// menu (`menu`: the Dish it's open for, and whether it shows the Columns);
// and the Board's Columns. While the Tour moves or deletes that Dish
// (`heldDishId`), a tap on its card doesn't open it. "Behalten" in the ⋯
// menu closes the menu (`closeMenu`). `modal`: its layer makes the Board
// behind inert, so what must stay reachable (the Toast's "Rückgängig")
// goes into it.
// On phones its last step depends on how malkochen runs: installed, in a
// browser that offered installing (useInstallPrompt; an offer coming
// during the Tour counts), or one that didn't.
const props = defineProps<{
  board: BoardView
  idle: boolean
  autoStart: boolean
  menu: { dishId: string, choosing: boolean } | null
}>()
const adding = defineModel<boolean>('adding', { required: true })
const emit = defineEmits<{ ended: [], closeMenu: [] }>()
const t = useStrings()
const { data: me } = useMe()
const splashUp = useSplashUp()
const installPrompt = useInstallPrompt()

// How long the Board stays idle before the Tour starts by itself: its cards
// have risen in by then.
const SETTLE_MS = 1200
const TARGETS: TourTarget[] = ['add-button', 'columns', 'board-switcher']

const tour = shallowRef<Tour | null>(null)
const step = computed(() => tour.value && tourStep(tour.value, t.tour))

function start() {
  tour.value = startTour({
    layout: isPhoneLayout() ? 'phone' : 'larger',
    columns: props.board.columns,
    targets: TARGETS.filter(target => tourTargetElements({ target, also: null, dishId: null, columnId: null }).length > 0),
    permissions: props.board.permissions,
    install: {
      installed: matchMedia('(display-mode: standalone)').matches,
      offered: installPrompt.offered.value,
      browser: tourBrowser(navigator.userAgent),
    },
  })
}

function dishAdded(dishId: string, columnId: string) {
  happened({ type: 'dishAdded', dishId, columnId })
}
const addingTourDish = computed(() => step.value?.id === 'addDishLink')
const heldDishId = computed(() => step.value?.id === 'moveDish' || step.value?.id === 'deleteDish' ? tour.value?.dishId ?? null : null)
const layer = useTemplateRef<{ modal: boolean }>('layer')
const modal = computed(() => layer.value?.modal ?? false)
defineExpose({ start, dishAdded, addingTourDish, heldDishId, modal })

watch(adding, isOpen => happened({ type: isOpen ? 'addDishOpened' : 'addDishClosed' }))
// Where the Tour's Dish is: the Column, or null once it's gone.
const dishIn = computed(() => {
  const dishId = tour.value?.dishId
  return dishId ? dishOnBoard(props.board, dishId)?.column.id ?? null : null
})
watch(dishIn, (columnId) => {
  const dishId = tour.value?.dishId
  if (dishId) happened(columnId ? { type: 'dishMoved', dishId, columnId } : { type: 'dishGone', dishId })
})
watch(() => props.menu, (menu, before) => {
  const shown = menu ?? before
  if (shown) happened({ type: 'dishMenu', dishId: shown.dishId, menu: menu ? (menu.choosing ? 'columns' : 'actions') : 'closed' })
})
watch(() => props.board.columns.map(({ id, name, isGekocht }) => ({ id, name, isGekocht })), (columns) => {
  if (tour.value && JSON.stringify(columns) !== JSON.stringify(tour.value.situation.columns)) happened({ type: 'columnsChanged', columns })
})
watch(installPrompt.offered, (offered) => {
  if (offered) happened({ type: 'installOffered' })
})

async function onChoose(button: TourButton) {
  // The browser's install dialog; its answer, either way, ends the Tour.
  if (button === 'install') {
    await installPrompt.install()
    happened({ type: 'installAnswered' })
    return
  }
  // Past the Dish steps, Add Dish closes if it's open.
  if (button === 'withoutDish') adding.value = false
  // Kept from inside the ⋯ menu, the menu closes.
  if (button === 'keep' && props.menu) emit('closeMenu')
  happened({ type: button === 'finish' ? 'next' : button })
}

function happened(event: TourEvent) {
  if (!tour.value) return
  const after = tourAfter(tour.value, event)
  if (after.status === 'running') {
    tour.value = after
    return
  }
  tour.value = null
  emit('ended')
  void recordSeen()
}

// Seen at once on this device (the Board switched to doesn't start it
// again), and for good on the server; if that fails, it starts again on the
// next visit.
async function recordSeen() {
  if (me.value) me.value = { ...me.value, tourSeen: Math.max(me.value.tourSeen ?? 0, TOUR_VERSION) }
  try {
    me.value = await $fetch<Me>('/api/me/tour', { method: 'PUT', body: { version: TOUR_VERSION } })
  }
  catch {
    // Offline or signed out meanwhile.
  }
}

const e2e = useRuntimeConfig().public.e2e
const due = computed(() => props.autoStart && props.idle && !splashUp.value && !tour.value
  && !!me.value && (me.value.tourSeen ?? 0) < TOUR_VERSION)
let timer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  if (e2e && !(window as { e2eTourAutoStart?: boolean }).e2eTourAutoStart) return
  watch(due, (isDue) => {
    clearTimeout(timer)
    if (isDue) timer = setTimeout(() => due.value && start(), SETTLE_MS)
  }, { immediate: true })
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <TourLayer
    ref="layer"
    :step="step"
    @choose="onChoose"
  />
</template>
