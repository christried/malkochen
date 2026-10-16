// The browser's offer to install malkochen (beforeinstallprompt: Chrome,
// Edge, Samsung Internet, Opera, Brave), kept from the moment the page loads
// until the Tour's last step uses it (#301): caught first by the head's
// inline script (nuxt.config.ts), which runs before the app does, then here
// (plugins/install-prompt.client.ts). Kept, it shows no install hint of the
// browser's own. One offer opens one dialog: once answered, or once
// installed, it's gone.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const offer = shallowRef<InstallPromptEvent | null>(null)

export function keepInstallPrompt() {
  const early = window as { __installPrompt?: InstallPromptEvent }
  if (early.__installPrompt) offer.value = early.__installPrompt
  delete early.__installPrompt
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    offer.value = event as InstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    offer.value = null
  })
}

export function useInstallPrompt() {
  const offered = computed(() => !!offer.value)
  // The browser's install dialog, until the user answers it. Without an
  // offer, or if the browser refuses to show it, nothing.
  async function install() {
    const event = offer.value
    if (!event) return
    offer.value = null
    try {
      await event.prompt()
      await event.userChoice
    }
    catch {
      // Already used, or the browser won't show it now.
    }
  }
  return { offered, install }
}
