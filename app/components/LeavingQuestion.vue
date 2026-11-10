<script setup lang="ts">
import { settleOtherUnsent } from '~/board/unsent-account'

// The question asked while Unsent Changes wait on the device (#463), shown
// over whatever page is open and blocking it until answered: before signing
// out, or when someone else signed in on a device that still holds another
// user's. Closing it any other way (Escape, the scrim) is the safe answer:
// nothing is discarded. It also settles what an account change leaves behind
// once the app knows who is signed in: another user's Unsent Changes (asked
// about, then discarded or kept), and the user's own, sent at once, so an
// expired sign-in that was renewed delivers them without a Board page.
const t = useStrings()
const device = useDevice()
const { question, ask } = useLeavingQuestion()
const { signOutKeepingUnsent } = useAuth()
const connection = useConnectionState()
const unsentChanges = useUnsentChanges()

const open = computed({
  get: () => question.value !== null,
  set: (value) => {
    if (!value) question.value?.answer(false)
  },
})
// Kept while the sheet moves out.
const shown = ref(question.value)
watch(question, (now) => {
  if (now) shown.value = now
})
const title = computed(() => !shown.value ? '' : shown.value.kind === 'signOut' ? t.leaving.signOutTitle : shown.value?.kind === 'switch' ? t.leaving.switchTitle : t.leaving.signOutNeedsNet)

// One settling at a time; a user whose question has been answered is not
// asked again this session.
let settling: Promise<unknown> | null = null
const settled = new Set<string>()
if (device) {
  watch(device.signedIn, (me) => {
    if (!me) return
    if (!settled.has(me.id) && !settling) {
      settling = settleOtherUnsent({
        store: device.store,
        userId: me.id,
        ask: count => ask('switch', count),
        leave: signOutKeepingUnsent,
      }).then((outcome) => {
        if (outcome !== 'declined') settled.add(me.id)
      }).finally(() => {
        settling = null
      })
    }
    // Their own, after the question: never before the others' are settled.
    void (settling ?? Promise.resolve()).then(async () => {
      if (device.signedIn.value?.id !== me.id || connection.value !== 'online') return
      if (await device.unsentCount() > 0) void unsentChanges.current.value?.send()
    })
  })
}
</script>

<template>
  <AppSheet
    v-model:open="open"
    variant="dialog"
    :title="title"
    :close-label="t.leaving.cancel"
  >
    <p
      v-if="shown && shown.kind !== 'needsNet'"
      class="mt-3 text-body text-text-muted"
    >
      {{ t.leaving.lost(shown.count) }}
    </p>
    <div class="mt-5 flex flex-col gap-2">
      <template v-if="shown?.kind === 'needsNet'">
        <button
          type="button"
          class="rounded-pill px-5 py-3 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          @click="question?.answer(true)"
        >
          {{ t.leaving.understood }}
        </button>
      </template>
      <template v-else>
        <DangerButton @click="question?.answer(true)">
          {{ shown?.kind === 'switch' ? t.leaving.switchGo : t.leaving.signOutGo }}
        </DangerButton>
        <button
          type="button"
          class="rounded-pill px-5 py-3 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          @click="question?.answer(false)"
        >
          {{ shown?.kind === 'switch' ? t.leaving.switchKeep : t.leaving.cancel }}
        </button>
      </template>
    </div>
  </AppSheet>
</template>
