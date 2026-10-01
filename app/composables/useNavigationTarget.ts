// Where the app is going: the page the error screen's "Nochmal versuchen"
// reloads. When a client-side navigation fails, the address bar still shows
// the page it came from, so the current route won't do. Kept up to date by
// plugins/navigation-target.ts.
export function useNavigationTarget() {
  return useState<string | null>('navigation-target', () => null)
}
