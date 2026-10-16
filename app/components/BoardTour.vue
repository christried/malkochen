<script setup lang="ts">
import type { BoardView } from '~~/server/utils/boards'
import type { Me } from '~~/server/utils/people'
import { startTour, tourAfter, tourStep, TOUR_VERSION, type Tour, type TourButton, type TourEvent, type TourTarget } from '~/tour/tour'

// The Tour (CONTEXT.md, #298) on the Board: feeds the Tour module what the
// Board is like and what the user chooses, and draws its steps (TourLayer).
// It starts by itself for a user who hasn't seen this version yet, once the
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
const props = defineProps<{ board: BoardView, idle: boolean, autoStart: boolean }>()
const adding = defineModel<boolean>('adding', { required: true })
const emit = defineEmits<{ ended: [] }>()
const t = useStrings()
const { data: me } = useMe()
const splashUp = useSplashUp()

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
    targets: TARGETS.filter(target => tourTargetElements({ target, dishId: null }).length > 0),
  })
}

function dishAdded(dishId: string) {
  happened({ type: 'dishAdded', dishId })
}
const addingTourDish = computed(() => step.value?.id === 'addDishLink')
defineExpose({ start, dishAdded, addingTourDish })

watch(adding, isOpen => happened({ type: isOpen ? 'addDishOpened' : 'addDishClosed' }))

function onChoose(button: TourButton) {
  // Past the Dish steps, Add Dish closes if it's open.
  if (button === 'withoutDish') adding.value = false
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
    :step="step"
    @choose="onChoose"
  />
</template>
