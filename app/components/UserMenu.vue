<script setup lang="ts">
import type { Me } from '~~/server/utils/people'

// The user menu (#131, decided on #105 as variant A): your Profile Picture at
// the top right of the Board opens a list like the Board switcher's panel,
// popping from its corner: who is signed in, then "Einstellungen" and
// "Abmelden", and last the legal pages (LegalLinks, #205). Phones don't show
// it; there your settings and the legal pages are the Board switcher's last
// rows.
//
// A menu button (WAI-ARIA APG): opening puts focus on a row (the last with
// ArrowUp), the arrows go round the rows, Home and End jump, Enter or Space
// choose, Escape closes and hands focus back to the picture. Tab and a press
// anywhere else close it.
defineProps<{ me: Pick<Me, 'name' | 'email' | 'image'> }>()
const t = useStrings()
const { signOut } = useAuth()
const route = useRoute()

const open = ref(false)
const menuId = useId()
const whoId = useId()
const root = useTemplateRef<HTMLElement>('root')
const button = useTemplateRef<HTMLButtonElement>('button')
const menu = useTemplateRef<HTMLElement>('menu')

function rows() {
  return [...menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []]
}

async function show(row: 'first' | 'last') {
  open.value = true
  await nextTick()
  rows().at(row === 'first' ? 0 : -1)?.focus()
}

// Escape closes it, and only it (not also the Board's search).
function closeOnEscape(event: KeyboardEvent) {
  if (!open.value) return
  event.preventDefault()
  close({ refocus: true })
}

function close({ refocus = false } = {}) {
  if (!open.value) return
  open.value = false
  if (refocus) button.value?.focus()
}

function toggle() {
  if (open.value) close()
  else void show('first')
}

function onMenuKeydown(event: KeyboardEvent) {
  const all = rows()
  const current = all.indexOf(document.activeElement as HTMLElement)
  // A link follows Enter only; Space chooses it too, as it does the button row.
  if (event.key === ' ' && all[current] instanceof HTMLAnchorElement) {
    event.preventDefault()
    all[current].click()
    return
  }
  const next = {
    ArrowDown: (current + 1) % all.length,
    ArrowUp: (current - 1 + all.length) % all.length,
    Home: 0,
    End: all.length - 1,
  }[event.key]
  if (next === undefined) return
  event.preventDefault()
  all[next]?.focus()
}

// Closed first, so the row can't be chosen twice while signing out.
function chooseSignOut() {
  close()
  void signOut()
}

function onPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) close()
}
onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
watch(() => route.fullPath, () => close())
</script>

<template>
  <div
    ref="root"
    class="relative"
    @keydown.esc="closeOnEscape"
  >
    <button
      ref="button"
      type="button"
      class="block rounded-full transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      :aria-label="t.userSettings.menu"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="menuId"
      @click="toggle"
      @keydown.down.prevent="show('first')"
      @keydown.up.prevent="show('last')"
    >
      <UserAvatar
        :name="me.name"
        :image="me.image"
        :size="44"
      />
    </button>

    <Transition name="panel">
      <div
        v-if="open"
        class="panel absolute right-0 top-full z-dialog mt-2 w-[300px] rounded-card bg-surface p-2 shadow-dialog"
      >
        <div class="flex items-center gap-3 px-2 py-2">
          <UserAvatar
            :name="me.name"
            :image="me.image"
            :size="44"
          />
          <span
            :id="whoId"
            class="flex min-w-0 flex-col"
          >
            <span class="truncate text-button">{{ me.name }}</span>
            <span class="truncate text-small text-text-muted">{{ me.email }}</span>
          </span>
        </div>
        <ul
          :id="menuId"
          ref="menu"
          role="menu"
          :aria-labelledby="whoId"
          class="mt-1 flex flex-col gap-1 border-t border-line pt-1"
          @keydown="onMenuKeydown"
          @keydown.tab="close()"
        >
          <li role="none">
            <NuxtLink
              to="/settings"
              role="menuitem"
              tabindex="-1"
              class="flex items-center gap-3 rounded-field px-3 py-2.5 text-button transition-transform duration-tap ease-tap hover:bg-surface-muted active:scale-[.98] focus-visible:outline-2 focus-visible:outline-focus"
            >
              <AppIcon
                name="settings"
                :size="20"
              />
              {{ t.userSettings.title }}
            </NuxtLink>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              tabindex="-1"
              class="flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left text-button transition-transform duration-tap ease-tap hover:bg-surface-muted active:scale-[.98] focus-visible:outline-2 focus-visible:outline-focus"
              @click="chooseSignOut"
            >
              <AppIcon
                name="sign-out"
                :size="20"
              />
              {{ t.userSettings.signOut }}
            </button>
          </li>
          <li
            role="none"
            class="border-t border-line pt-1"
          >
            <LegalLinks
              menu
              role="none"
              class="px-1"
              @click="close()"
            />
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* As the Board switcher's panel, but from the top right corner. */
.panel {
  transform-origin: top right;
}
.panel-enter-active {
  transition: translate var(--dur-pop) var(--ease-pop), scale var(--dur-pop) var(--ease-pop), opacity var(--dur-fade) var(--ease-fade);
}
.panel-leave-active {
  transition: opacity var(--dur-fade) var(--ease-fade);
  pointer-events: none;
}
.panel-enter-from {
  translate: 0 -16px;
  scale: .96;
  opacity: 0;
}
.panel-leave-to {
  opacity: 0;
}
</style>
