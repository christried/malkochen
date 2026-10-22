<script setup lang="ts">
import { SOURCE_COLUMNS, type AdminFigures, type Period, type Usage } from '~~/shared/admin'

// The Admin Page (#348, PRD #321 stories 26–36, 39): the Operator's figures
// on how malkochen is used, as plain tables, linked at the end of their
// settings. Counts only, never content. For anyone else the API answers
// "not found", and so does this page.

const t = useStrings()

const { data: figures, error } = await useFetch<AdminFigures>('/api/admin')
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusMessage, fatal: true })

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
</style>
