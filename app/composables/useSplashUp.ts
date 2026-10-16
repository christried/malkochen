// Whether the splash (SplashScreen) is over the page: up or fading, from the
// server's render until it has gone. What mustn't start under it waits.
export function useSplashUp() {
  return useState('splash-up', () => false)
}
