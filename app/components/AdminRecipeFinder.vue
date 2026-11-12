<script setup lang="ts">
import type { AdminRecipeFinderUser } from '~~/shared/recipe-finder'

// The Recipe Finder on the Admin Page (#498, ADR 0013, design R13
// AdminRecipeFinder): everyone who asked or has it, requests first, with the
// Operator's switch for each and their searches. From 768px a table, below it
// a list. The switch works at once, like the others on the page. Switched off,
// a user is off again and the server forgets their request, so they leave the
// list; they stay in place here until the page is loaded again, so a row
// doesn't jump away under the Operator's finger.
const t = useStrings()

// Typed as a plain string: Nitro's route typing runs too deep here.
const RECIPE_FINDER: string = '/api/admin/recipe-finder'
const { data: users } = useFetch<AdminRecipeFinderUser[]>(RECIPE_FINDER)

// What the Operator switched since the list was loaded, by user.
const switched = reactive<Record<string, boolean>>({})
const busy = ref<string | null>(null)
const failed = ref(false)

const isOn = (user: AdminRecipeFinderUser) => switched[user.id] ?? user.state === 'on'
const nameOf = (user: AdminRecipeFinderUser) => user.name || user.email
const searchesOf = (user: AdminRecipeFinderUser) => user.searches > 0 ? t.recipeFinder.admin.searches(user.searches, user.searchesToday) : t.recipeFinder.admin.noSearches

// As loaded, not as switched since: "2 angefragt, 3 eingeschaltet".
const summary = computed(() => {
  const list = users.value ?? []
  if (list.length === 0) return t.recipeFinder.admin.nobody
  const on = list.filter(user => user.state === 'on').length
  return t.recipeFinder.admin.summary(list.length - on, on)
})

async function turn(user: AdminRecipeFinderUser) {
  if (busy.value) return
  const was = isOn(user)
  busy.value = user.id
  failed.value = false
  switched[user.id] = !was
  try {
    await $fetch(`${RECIPE_FINDER}/${user.id}`, { method: 'PUT', body: { on: !was } })
  }
  catch {
    switched[user.id] = was
    failed.value = true
  }
  finally {
    busy.value = null
  }
}
</script>

<template>
  <section
    class="flex flex-col gap-3"
    aria-labelledby="admin-recipe-finder"
  >
    <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1">
      <h2
        id="admin-recipe-finder"
        class="section-heading"
      >
        {{ t.recipeFinder.heading }}
      </h2>
      <p class="text-small text-text-muted">
        {{ summary }}
      </p>
    </div>

    <p
      v-if="users && users.length === 0"
      class="rounded-card bg-surface-muted p-4 text-small text-text-muted"
    >
      {{ t.recipeFinder.admin.empty }}
    </p>

    <template v-else-if="users">
      <!-- From 768px: a table. -->
      <div class="finder-table hidden rounded-card bg-surface-muted tablet:block">
        <table>
          <thead>
            <tr>
              <th scope="col">
                {{ t.recipeFinder.admin.person }}
              </th>
              <th scope="col">
                {{ t.recipeFinder.admin.askedColumn }}
              </th>
              <th scope="col">
                {{ t.recipeFinder.admin.searchesColumn }}
              </th>
              <th
                scope="col"
                class="text-right"
              >
                {{ t.recipeFinder.admin.switchColumn }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in users"
              :key="user.id"
              data-testid="admin-recipe-finder-user"
            >
              <td>
                <div class="flex min-w-0 items-center gap-3">
                  <UserAvatar
                    :name="nameOf(user)"
                    :image="user.image"
                    :size="34"
                  />
                  <div class="flex min-w-0 flex-col gap-0.5">
                    <span class="truncate text-body font-semibold">{{ nameOf(user) }}</span>
                    <span class="truncate text-caption text-text-muted">{{ user.email }}</span>
                  </div>
                </div>
              </td>
              <td class="text-small">
                {{ user.askedAt ? t.recipeFinder.admin.askedDay(user.askedAt) : '' }}
              </td>
              <td>
                <div class="flex items-baseline gap-2">
                  <span class="text-body font-semibold">{{ t.admin.count(user.searches) }}</span>
                  <span class="text-caption text-text-muted">{{ t.recipeFinder.admin.searchesToday(user.searchesToday) }}</span>
                </div>
              </td>
              <td class="text-right">
                <SettingsSwitch
                  compact
                  :label="t.recipeFinder.admin.switchFor(nameOf(user))"
                  :hint="searchesOf(user)"
                  :checked="isOn(user)"
                  :busy="busy === user.id"
                  :disabled="busy !== null"
                  @toggle="turn(user)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Below 768px: a list. -->
      <ul class="finder-list rounded-card bg-surface-muted tablet:hidden">
        <li
          v-for="user in users"
          :key="user.id"
          data-testid="admin-recipe-finder-user"
        >
          <UserAvatar
            :name="nameOf(user)"
            :image="user.image"
            :size="34"
          />
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <span class="truncate text-body font-semibold">{{ nameOf(user) }}</span>
            <span
              v-if="user.askedAt"
              class="text-caption text-text-muted"
            >{{ t.recipeFinder.admin.askedOn(user.askedAt) }}</span>
            <span class="text-caption text-text-muted">{{ searchesOf(user) }}</span>
          </div>
          <SettingsSwitch
            compact
            :label="t.recipeFinder.admin.switchFor(nameOf(user))"
            :hint="searchesOf(user)"
            :checked="isOn(user)"
            :busy="busy === user.id"
            :disabled="busy !== null"
            @toggle="turn(user)"
          />
        </li>
      </ul>
    </template>

    <p
      role="alert"
      class="px-1 text-small text-danger empty:hidden"
    >{{ failed ? t.recipeFinder.admin.failed : '' }}</p>
  </section>
</template>

<style scoped>
/* Plain rows on a card, a hairline between them. */
.finder-table {
  overflow-x: auto;
}
.finder-table table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.finder-table th,
.finder-table td {
  padding: 12px 16px;
  text-align: left;
  vertical-align: middle;
}
.finder-table td:first-child {
  max-width: 22rem;
}
.finder-table thead th {
  color: var(--color-text-muted);
  font-size: 12.5px;
  font-weight: 600;
}
.finder-table tbody tr {
  border-top: 1px solid var(--color-line);
}
.finder-table td:last-child {
  width: 7.5rem;
}
.finder-table td:last-child :deep(button) {
  margin-left: auto;
}

.finder-list > li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
}
.finder-list > li + li {
  border-top: 1px solid var(--color-line);
}
</style>
