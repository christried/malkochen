// Keeps the browser's offer to install malkochen from the page's load on, so
// it's still there when the Tour's last step comes (useInstallPrompt).
export default defineNuxtPlugin(() => {
  keepInstallPrompt()
})
