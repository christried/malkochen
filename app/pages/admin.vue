<script setup lang="ts">
import { boardPath, dishPath } from '~~/shared/address'
import { EVENT_GROUPS, SOURCE_COLUMNS, type AdminBoard, type AdminEvent, type AdminEventPage, type AdminFigures, type EventGroup, type NamedBoard, type NamedColumn, type NamedUser, type Period, type Usage } from '~~/shared/admin'

// The Admin Page (#348, PRD #321 stories 26–36, 39): the Operator's figures
// on how malkochen is used, as plain tables, linked at the end of their
// settings. Counts only, never content. For anyone else the API answers
// "not found", and so does this page.

const t = useStrings()

const { data: figures, error } = await useFetch<AdminFigures>('/api/admin')
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusMessage, fatal: true })

// Every Board (#397, ADR 0009): searched by Board name or Owner, refetched
// 250ms after the last key.
const boardQuery = ref('')
const { data: boardList, refresh: refreshBoards } = await useFetch<AdminBoard[]>('/api/admin/boards', { query: { q: boardQuery }, watch: false })
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(boardQuery, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(refreshBoards, 250)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

// The Event Log (#400): 50 events at a time, newest first, filtered by
// Username, Board, a group of kinds and a time range. The filters live in the
// URL (?user=&board=&group=&from=&to=), so a filtered view can be reloaded
// and linked. Changing one reloads from the top; scrolling to the end (or
// "Mehr laden") appends the next 50.
const route = useRoute()
const router = useRouter()
const fromQuery = (key: string) => {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}
const eventFilters = reactive({
  user: fromQuery('user'),
  board: fromQuery('board'),
  group: (fromQuery('group') in EVENT_GROUPS ? fromQuery('group') : '') as EventGroup | '',
  from: fromQuery('from'),
  to: fromQuery('to'),
})
const eventGroups = Object.keys(EVENT_GROUPS) as EventGroup[]

function eventQuery(before?: number) {
  const { user, board, group, from, to } = eventFilters
  return {
    ...user.trim() ? { user: user.trim() } : {},
    ...board ? { board } : {},
    ...group ? { kinds: EVENT_GROUPS[group].join(',') } : {},
    ...from ? { from } : {},
    ...to ? { to } : {},
    ...before ? { before } : {},
  }
}

const { data: firstEvents } = await useFetch<AdminEventPage>('/api/admin/events', { query: eventQuery(), watch: false })
const events = ref<AdminEvent[]>(firstEvents.value?.events ?? [])
const nextEvents = ref<number | null>(firstEvents.value?.next ?? null)
const eventsLoading = ref(false)
const eventsFailed = ref(false)
// Answers that come back after the filters changed again are dropped.
let eventsRequest = 0

async function loadEvents(more: boolean) {
  if (more && (nextEvents.value === null || eventsLoading.value)) return
  const request = ++eventsRequest
  eventsLoading.value = true
  eventsFailed.value = false
  try {
    const page = await $fetch<AdminEventPage>('/api/admin/events', { query: eventQuery(more ? nextEvents.value ?? undefined : undefined) })
    if (request !== eventsRequest) return
    events.value = more ? [...events.value, ...page.events] : page.events
    nextEvents.value = page.next
  }
  catch {
    if (request === eventsRequest) eventsFailed.value = true
  }
  finally {
    if (request === eventsRequest) eventsLoading.value = false
  }
}

let eventTimer: ReturnType<typeof setTimeout> | undefined
function filtersChanged(delay: number) {
  clearTimeout(eventTimer)
  eventTimer = setTimeout(() => {
    const query = Object.fromEntries(Object.entries({ user: eventFilters.user.trim(), board: eventFilters.board, group: eventFilters.group, from: eventFilters.from, to: eventFilters.to }).filter(([, value]) => value))
    void router.replace({ query })
    void loadEvents(false)
  }, delay)
}
watch(() => eventFilters.user, () => filtersChanged(250))
watch(() => [eventFilters.board, eventFilters.group, eventFilters.from, eventFilters.to], () => filtersChanged(0))

// The Boards the filter offers: the Boards section's list, and the chosen
// one if the list is searched down to something else.
const boardChoices = computed(() => {
  const list = boardList.value ?? []
  return !eventFilters.board || list.some(b => b.id === eventFilters.board)
    ? list
    : [...list, { id: eventFilters.board, emoji: '', name: eventFilters.board }]
})

const eventsEnd = ref<HTMLElement | null>(null)
let eventsObserver: IntersectionObserver | undefined
onMounted(() => {
  if (!eventsEnd.value || typeof IntersectionObserver === 'undefined') return
  eventsObserver = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) void loadEvents(true)
  }, { rootMargin: '200px' })
  eventsObserver.observe(eventsEnd.value)
})
onBeforeUnmount(() => {
  clearTimeout(eventTimer)
  eventsObserver?.disconnect()
})

// How the page writes what the Event Log names (ADR 0009): what is gone is
// shown as gone, in muted text.
const userName = (user: NamedUser) => user === 'deleted' ? t.history.deletedAccount : user === 'signed-out' ? t.admin.signedOut : user.name
const userGone = (user: NamedUser) => typeof user === 'string'
const columnName = (column: NamedColumn) => column === 'deleted' ? t.admin.deleted : column.name

// The small details of an event after its kind: a Member, a Permission and
// whether it is on, a thumb, the fields edited, the Columns moved between.
function eventDetails(e: AdminEvent): string {
  const { details } = e
  const parts: string[] = []
  if (e.member) parts.push(userName(e.member))
  const onOff = details.on === undefined ? '' : details.on ? t.admin.eventOn : t.admin.eventOff
  if (details.permission) parts.push(`${t.settings.permission[details.permission].label} ${onOff}`.trim())
  else if (onOff) parts.push(onOff)
  if (details.up !== undefined) parts.push(details.up ? '👍' : '👎')
  if (details.fields) parts.push(details.fields.map(field => t.admin.dishFields[field as keyof typeof t.admin.dishFields] ?? field).join(', '))
  if (e.column) parts.push(columnName(e.column))
  if (e.from && e.to) parts.push(t.admin.movedFromTo(columnName(e.from), columnName(e.to)))
  if (e.fromBoard) parts.push(t.admin.movedFromBoard(e.fromBoard === 'deleted' ? t.admin.deleted : `${e.fromBoard.emoji} ${e.fromBoard.name}`))
  return parts.join(', ')
}

const liveBoard = (board: NamedBoard | null) => board !== null && board !== 'deleted' && !board.archived ? board : null

useHead({ title: () => `${t.admin.title} · ${t.app.name}` })

const dishTotal = (period: Period) => Object.values(period.dishes).reduce((sum, n) => sum + n, 0)

const periodTables = computed(() => figures.value
  ? [
      { id: 'days', caption: t.admin.perDay, first: t.admin.day, periods: figures.value.days },
      { id: 'weeks', caption: t.admin.perWeek, first: t.admin.weekOf, periods: figures.value.weeks },
    ]
  : [])

const activeRows = computed(() => figures.value
  ? [
      { label: t.admin.today, ...figures.value.active.today },
      { label: t.admin.week, ...figures.value.active.week },
      { label: t.admin.month, ...figures.value.active.month },
    ]
  : [])

const limitRows = computed(() => {
  const limits = figures.value?.limits
  if (!limits) return []
  const bytes = (usage: Usage) => ({ used: t.admin.megabytes(usage.used), free: t.admin.megabytes(usage.free) })
  const counted = (usage: Usage) => ({ used: t.admin.count(usage.used), free: t.admin.count(usage.free) })
  return [
    { label: t.admin.database, usage: limits.database, ...bytes(limits.database) },
    { label: t.admin.blob, usage: limits.blob, ...bytes(limits.blob) },
    { label: t.admin.emailsMonth, usage: limits.emailsMonth, ...counted(limits.emailsMonth) },
    { label: t.admin.emailsToday, usage: limits.emailsToday, ...counted(limits.emailsToday) },
    { label: t.admin.functionCalls, usage: limits.functionCalls, ...counted(limits.functionCalls) },
  ].map(row => ({ ...row, share: row.usage.used / row.usage.free }))
})

// "Anmeldung offen" (#350): Open Sign-up, switched at once on the server.
// `failed`: the last switch didn't work out, and it stays as it was.
const openSignUp = reactive({ busy: false, failed: false })
async function switchOpenSignUp() {
  if (!figures.value || openSignUp.busy) return
  const on = !figures.value.openSignUp
  openSignUp.busy = true
  openSignUp.failed = false
  try {
    await $fetch('/api/admin/open-sign-up', { method: 'PUT', body: { on } })
    figures.value.openSignUp = on
  }
  catch {
    openSignUp.failed = true
  }
  finally {
    openSignUp.busy = false
  }
}

// Where the rest of each free tier is shown.
const DASHBOARDS = [
  { name: 'Vercel', href: 'https://vercel.com/dashboard' },
  { name: 'Neon', href: 'https://console.neon.tech' },
  { name: 'Resend', href: 'https://resend.com/emails' },
]
</script>

<template>
  <main
    v-if="figures"
    class="min-h-dvh bg-bg px-4 pb-32 pt-6 text-text tablet:px-10"
  >
    <div class="mx-auto flex max-w-[1080px] flex-col gap-8">
      <header class="flex items-center gap-3">
        <NuxtLink
          to="/"
          :aria-label="t.admin.back"
          :data-tooltip="t.admin.back"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        >
          <AppIcon
            name="back"
            :size="20"
          />
        </NuxtLink>
        <h1 class="font-display text-title-l tablet:text-display-m">
          {{ t.admin.title }}
        </h1>
      </header>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="admin-sign-up"
      >
        <h2
          id="admin-sign-up"
          class="section-heading px-1"
        >
          {{ t.admin.signUp }}
        </h2>
        <div class="flex flex-col gap-3 rounded-card bg-surface-muted p-4">
          <SettingsSwitch
            :label="t.admin.openSignUp"
            :hint="t.admin.openSignUpHint"
            :checked="figures.openSignUp"
            :busy="openSignUp.busy"
            :disabled="openSignUp.busy"
            @toggle="switchOpenSignUp"
          />
          <p
            role="alert"
            class="text-small text-danger empty:hidden"
          >{{ openSignUp.failed ? t.admin.openSignUpFailed : '' }}</p>
        </div>
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="admin-limits"
      >
        <h2
          id="admin-limits"
          class="section-heading px-1"
        >
          {{ t.admin.limits }}
        </h2>
        <p class="px-1 text-small text-text-muted">
          {{ t.admin.limitsHint }}
        </p>
        <div class="admin-table">
          <table>
            <thead>
              <tr>
                <th scope="col">
                  {{ t.admin.figure }}
                </th>
                <th scope="col">
                  {{ t.admin.used }}
                </th>
                <th scope="col">
                  {{ t.admin.free }}
                </th>
                <th scope="col">
                  {{ t.admin.share }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in limitRows"
                :key="row.label"
              >
                <th scope="row">
                  {{ row.label }}
                </th>
                <td>{{ row.used }}</td>
                <td>{{ row.free }}</td>
                <td :class="{ 'font-semibold text-danger': row.share >= 0.8 }">
                  {{ t.admin.percent(row.share) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="flex flex-wrap gap-x-4 gap-y-1 px-1 text-small">
          <span class="text-text-muted">{{ t.admin.dashboards }}:</span>
          <a
            v-for="dashboard in DASHBOARDS"
            :key="dashboard.name"
            :href="dashboard.href"
            target="_blank"
            rel="noopener noreferrer"
            class="underline underline-offset-2"
          >{{ dashboard.name }}</a>
        </p>
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="admin-active"
      >
        <h2
          id="admin-active"
          class="section-heading px-1"
        >
          {{ t.admin.active }}
        </h2>
        <p class="px-1 text-small text-text-muted">
          {{ t.admin.activeHint }}
        </p>
        <div class="admin-table">
          <table>
            <thead>
              <tr>
                <td />
                <th scope="col">
                  {{ t.admin.people }}
                </th>
                <th scope="col">
                  {{ t.admin.boards }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in activeRows"
                :key="row.label"
              >
                <th scope="row">
                  {{ row.label }}
                </th>
                <td>{{ t.admin.count(row.users) }}</td>
                <td>{{ t.admin.count(row.boards) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="admin-dishes"
      >
        <h2
          id="admin-dishes"
          class="section-heading px-1"
        >
          {{ t.admin.dishes }}
        </h2>
        <div
          v-for="table in periodTables"
          :key="table.id"
          class="admin-table"
        >
          <table>
            <caption>{{ table.caption }}</caption>
            <thead>
              <tr>
                <th scope="col">
                  {{ table.first }}
                </th>
                <th
                  v-for="kind in SOURCE_COLUMNS"
                  :key="kind"
                  scope="col"
                >
                  {{ t.admin.sources[kind] }}
                </th>
                <th scope="col">
                  {{ t.admin.total }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="period in table.periods"
                :key="period.start"
              >
                <th scope="row">
                  {{ t.admin.date(period.start) }}
                </th>
                <td
                  v-for="kind in SOURCE_COLUMNS"
                  :key="kind"
                >
                  {{ t.admin.count(period.dishes[kind]) }}
                </td>
                <td class="font-semibold">
                  {{ t.admin.count(dishTotal(period)) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="admin-activity"
      >
        <h2
          id="admin-activity"
          class="section-heading px-1"
        >
          {{ t.admin.activity }}
        </h2>
        <div
          v-for="table in periodTables"
          :key="table.id"
          class="admin-table"
        >
          <table>
            <caption>{{ table.caption }}</caption>
            <thead>
              <tr>
                <th scope="col">
                  {{ table.first }}
                </th>
                <th scope="col">
                  {{ t.admin.moves }}
                </th>
                <th scope="col">
                  {{ t.admin.cookings }}
                </th>
                <th scope="col">
                  {{ t.admin.comments }}
                </th>
                <th scope="col">
                  {{ t.admin.votes }}
                </th>
                <th scope="col">
                  {{ t.admin.archived }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="period in table.periods"
                :key="period.start"
              >
                <th scope="row">
                  {{ t.admin.date(period.start) }}
                </th>
                <td>{{ t.admin.count(period.moves) }}</td>
                <td>{{ t.admin.count(period.cookings) }}</td>
                <td>{{ t.admin.count(period.comments) }}</td>
                <td>{{ t.admin.count(period.votes) }}</td>
                <td>{{ t.admin.count(period.archived) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="admin-sign-ups"
      >
        <h2
          id="admin-sign-ups"
          class="section-heading px-1"
        >
          {{ t.admin.signUps }}
        </h2>
        <p class="px-1 text-small text-text-muted">
          {{ t.admin.signUpsHint }}
        </p>
        <div class="admin-table">
          <table>
            <thead>
              <tr>
                <th scope="col">
                  {{ t.admin.day }}
                </th>
                <th scope="col">
                  {{ t.admin.google }}
                </th>
                <th scope="col">
                  {{ t.admin.email }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="day in figures.signUps"
                :key="day.start"
              >
                <th scope="row">
                  {{ t.admin.date(day.start) }}
                </th>
                <td>{{ t.admin.count(day.google) }}</td>
                <td>{{ t.admin.count(day.email) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="admin-boards"
      >
        <h2
          id="admin-boards"
          class="section-heading px-1"
        >
          {{ t.admin.boards }}
        </h2>
        <input
          v-model="boardQuery"
          type="search"
          data-testid="admin-board-search"
          :placeholder="t.admin.boardSearch"
          :aria-label="t.admin.boardSearch"
          maxlength="100"
          class="h-11 rounded-card bg-surface-muted px-4 focus-visible:outline-2 focus-visible:outline-focus"
        >
        <p
          v-if="boardList && boardList.length === 0"
          class="px-1 text-small text-text-muted"
        >
          {{ t.admin.noBoards }}
        </p>
        <div
          v-else
          class="admin-table"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">
                  {{ t.admin.boards }}
                </th>
                <th scope="col">
                  {{ t.admin.boardOwner }}
                </th>
                <th scope="col">
                  {{ t.admin.boardMembers }}
                </th>
                <th scope="col">
                  {{ t.admin.boardDishes }}
                </th>
                <th scope="col">
                  {{ t.admin.boardLastActive }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="b in boardList"
                :key="b.id"
                data-testid="admin-board"
              >
                <th scope="row">
                  <NuxtLink
                    v-if="!b.archived"
                    :to="boardPath({ slug: b.slug })"
                    class="underline underline-offset-2"
                  >
                    {{ b.emoji }} {{ b.name }}
                  </NuxtLink>
                  <template v-else>
                    {{ b.emoji }} {{ b.name }}
                  </template>
                  <span
                    v-if="b.archived"
                    class="ml-2 text-small text-text-muted"
                  >{{ t.admin.boardArchived }}</span>
                </th>
                <td>{{ b.owner ?? '' }}</td>
                <td>{{ t.admin.count(b.members) }}</td>
                <td>{{ t.admin.count(b.dishes) }}</td>
                <td>{{ b.lastActivity ? t.admin.lastActive(b.lastActivity) : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="admin-events"
      >
        <h2
          id="admin-events"
          class="section-heading px-1"
        >
          {{ t.admin.events }}
        </h2>
        <p class="px-1 text-small text-text-muted">
          {{ t.admin.eventsHint }}
        </p>
        <form
          class="grid grid-cols-2 gap-3 tablet:grid-cols-[2fr_2fr_2fr_1.4fr_1.4fr]"
          @submit.prevent
        >
          <AppField
            class="col-span-2 tablet:col-span-1"
            :label="t.admin.eventUser"
            control-id="admin-event-user"
          >
            <input
              id="admin-event-user"
              v-model="eventFilters.user"
              type="search"
              maxlength="100"
              autocomplete="off"
            >
          </AppField>
          <AppField
            class="col-span-2 tablet:col-span-1"
            :label="t.admin.eventBoard"
            control-id="admin-event-board"
          >
            <select
              id="admin-event-board"
              v-model="eventFilters.board"
            >
              <option value="">
                {{ t.admin.allBoards }}
              </option>
              <option
                v-for="b in boardChoices"
                :key="b.id"
                :value="b.id"
              >
                {{ b.emoji }} {{ b.name }}
              </option>
            </select>
            <AppIcon name="down" />
          </AppField>
          <AppField
            class="col-span-2 tablet:col-span-1"
            :label="t.admin.eventGroup"
            control-id="admin-event-group"
          >
            <select
              id="admin-event-group"
              v-model="eventFilters.group"
            >
              <option value="">
                {{ t.admin.allEvents }}
              </option>
              <option
                v-for="group in eventGroups"
                :key="group"
                :value="group"
              >
                {{ t.admin.eventGroups[group] }}
              </option>
            </select>
            <AppIcon name="down" />
          </AppField>
          <AppField
            :label="t.admin.eventFrom"
            control-id="admin-event-from"
          >
            <input
              id="admin-event-from"
              v-model="eventFilters.from"
              type="date"
            >
          </AppField>
          <AppField
            :label="t.admin.eventTo"
            control-id="admin-event-to"
          >
            <input
              id="admin-event-to"
              v-model="eventFilters.to"
              type="date"
            >
          </AppField>
        </form>

        <p
          v-if="events.length === 0 && !eventsLoading"
          class="px-1 text-small text-text-muted"
        >
          {{ t.admin.noEvents }}
        </p>
        <ol
          v-else
          class="admin-events"
          :aria-busy="eventsLoading"
        >
          <li
            v-for="e in events"
            :key="e.id"
            data-testid="admin-event"
            :data-kind="e.kind"
            class="admin-event"
          >
            <time
              :datetime="e.at"
              class="text-small text-text-muted"
            >{{ t.admin.dateTime(e.at) }}</time>
            <span :class="{ 'text-text-muted': userGone(e.user) }">{{ userName(e.user) }}</span>
            <span>
              <span class="font-semibold">{{ t.admin.eventKinds[e.kind] }}</span>
              <template v-if="eventDetails(e)">
                {{ ' ' }}{{ eventDetails(e) }}
              </template>
              <span
                v-if="e.comment"
                class="admin-event-comment"
                :class="{ 'text-text-muted': e.comment === 'deleted' }"
              >{{ e.comment === 'deleted' ? t.admin.commentDeleted : e.comment.text }}</span>
            </span>
            <span class="admin-event-where">
              <template v-if="e.board">
                <span
                  v-if="e.board === 'deleted'"
                  class="text-text-muted"
                >{{ t.admin.deleted }}</span>
                <NuxtLink
                  v-else-if="!e.board.archived"
                  :to="boardPath(e.board)"
                  class="underline underline-offset-2"
                >{{ e.board.emoji }} {{ e.board.name }}</NuxtLink>
                <span v-else>
                  {{ e.board.emoji }} {{ e.board.name }}
                  <span class="text-text-muted">{{ t.admin.boardArchived }}</span>
                </span>
              </template>
              <template v-if="e.dish">
                <span
                  v-if="e.dish === 'deleted'"
                  class="text-text-muted"
                >{{ t.admin.deleted }}</span>
                <NuxtLink
                  v-else-if="liveBoard(e.board) && !e.dish.archived"
                  :to="dishPath(liveBoard(e.board)!, e.dish)"
                  class="underline underline-offset-2"
                >{{ e.dish.title }}</NuxtLink>
                <span v-else>
                  {{ e.dish.title }}
                  <span
                    v-if="e.dish.archived"
                    class="text-text-muted"
                  >{{ t.admin.boardArchived }}</span>
                </span>
              </template>
            </span>
          </li>
        </ol>
        <div ref="eventsEnd" />
        <p
          v-if="eventsFailed"
          role="alert"
          class="px-1 text-small text-danger"
        >
          {{ t.admin.openSignUpFailed }}
        </p>
        <button
          v-if="nextEvents !== null"
          type="button"
          data-testid="admin-events-more"
          :disabled="eventsLoading"
          class="h-11 self-center rounded-full bg-surface-muted px-6 font-semibold focus-visible:outline-2 focus-visible:outline-focus"
          @click="loadEvents(true)"
        >
          {{ t.admin.loadMore }}
        </button>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* Plain tables on a card, scrolling sideways on a phone rather than the page. */
.admin-table {
  overflow-x: auto;
  border-radius: var(--radius-card);
  background: var(--color-surface-muted);
}
.admin-table table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.admin-table caption {
  padding: 12px 16px 4px;
  text-align: left;
  font-weight: 600;
}
.admin-table th,
.admin-table td {
  padding: 8px 12px;
  text-align: right;
  white-space: nowrap;
}
.admin-table th[scope="row"],
.admin-table thead th:first-child {
  text-align: left;
  font-weight: 500;
}
.admin-table th[scope="row"] {
  white-space: normal;
  min-width: 10rem;
}
.admin-table thead th {
  color: var(--color-text-muted);
  font-weight: 500;
}
.admin-table tbody tr + tr {
  border-top: 1px solid var(--color-line);
}

/* The Event Log: on a phone each event stacks (when, who, what, where); from
   tablet on it is a grid of four columns. Long words wrap and a Comment ends
   in an ellipsis, so nothing widens the page. */
.admin-events {
  border-radius: var(--radius-card);
  background: var(--color-surface-muted);
  overflow: hidden;
}
.admin-event {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2px 16px;
  padding: 12px 16px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.admin-event > * {
  min-width: 0;
}
.admin-event + .admin-event {
  border-top: 1px solid var(--color-line);
}
.admin-event-where {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.admin-event-comment {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (min-width: 768px) {
  .admin-event {
    grid-template-columns: 8.5rem 9rem minmax(0, 1.4fr) minmax(0, 1fr);
    align-items: baseline;
  }
}
</style>
