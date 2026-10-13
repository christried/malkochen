// Escape leaves a settings page for `to`, where its back link goes (#207),
// under the keyboard shortcuts' own rules (utils/shortcuts.ts): not while
// typing in a field, and not while a dialog is open over the page, which
// Escape closes instead.
export function useEscapeToLeave(to: () => string) {
  useBoardShortcuts((shortcut) => {
    if (shortcut.action !== 'close') return false
    void navigateTo(to())
    return true
  }, () => false)
}
