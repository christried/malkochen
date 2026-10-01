<script setup lang="ts">
// Your own settings (PRD stories 73–75): the Google account you're signed in
// with, Darstellung, a place kept for Sprache (German only for now) and
// signing out. Reached from your photo on the Board (on phones, from the
// Board switcher).
const t = useStrings()
const { signOut } = useAuth()

const { data: me } = await useMe()

useHead({ title: () => `${t.userSettings.title} · ${t.app.name}` })
</script>

<template>
  <main class="min-h-dvh bg-bg px-4 pb-32 pt-6 text-text tablet:px-10">
    <div class="mx-auto flex max-w-[560px] flex-col gap-8">
      <header class="flex items-center gap-3">
        <NuxtLink
          to="/"
          :aria-label="t.userSettings.back"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        >
          <AppIcon
            name="back"
            :size="20"
          />
        </NuxtLink>
        <h1 class="font-display text-title-l tablet:text-display-m">
          {{ t.userSettings.title }}
        </h1>
      </header>

      <section
        v-if="me"
        class="flex flex-col gap-3"
        aria-labelledby="settings-account"
      >
        <h2
          id="settings-account"
          class="px-1 text-overline uppercase text-text-muted"
        >
          {{ t.userSettings.account }}
        </h2>
        <div class="flex items-center gap-4 rounded-card bg-surface p-4">
          <UserAvatar
            :name="me.name"
            :image="me.image"
            :size="56"
          />
          <div class="flex min-w-0 flex-col">
            <span class="truncate font-display text-title-s">{{ me.name }}</span>
            <span class="truncate text-body-s text-text-muted">{{ me.email }}</span>
          </div>
        </div>
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="settings-theme"
      >
        <h2
          id="settings-theme"
          class="px-1 text-overline uppercase text-text-muted"
        >
          {{ t.theme.label }}
        </h2>
        <ThemePicker />
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="settings-language"
      >
        <h2
          id="settings-language"
          class="px-1 text-overline uppercase text-text-muted"
        >
          {{ t.userSettings.language }}
        </h2>
        <div class="flex flex-col gap-1 rounded-card bg-surface p-4">
          <span class="text-body">{{ t.userSettings.german }}</span>
          <span class="text-body-s text-text-muted">{{ t.userSettings.moreLanguages }}</span>
        </div>
      </section>

      <button
        type="button"
        class="self-start rounded-pill bg-surface-muted px-5 py-3.5 text-button text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        @click="signOut"
      >
        {{ t.userSettings.signOut }}
      </button>
    </div>
  </main>
</template>
