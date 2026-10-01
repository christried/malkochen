// What the Toast (AppToast) shows. A new one replaces the one showing.
export interface Toast {
  text: string
  // Buttons beside the text, e.g. "Rückgängig" (the Gekocht toast has two).
  actions?: ToastAction[]
  // How long it stays, in ms.
  duration: number
  // The Gekocht toast: it comes a moment after the Cooking's confetti
  // (useConfetti), and Topfbert pops up behind it while it shows.
  celebrate?: boolean
}

export interface ToastAction {
  label: string
  run: () => void
}

// How long "Rückgängig" is offered (handoff: Toast, 5s undo window).
export const UNDO_WINDOW_MS = 5000
// How long a notice without actions stays: long enough to read a sentence.
export const NOTICE_MS = 8000
