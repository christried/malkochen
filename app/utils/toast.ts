// What the Toast (AppToast) shows. A new one replaces the one showing.
export interface Toast {
  text: string
  // Said to screen readers after `text`, for what shows only elsewhere:
  // the other Board a Dish was cooked into, named in the Gekocht pill.
  unseen?: string
  // Buttons beside the text, e.g. "Rückgängig".
  actions?: ToastAction[]
  // The Gekocht toast's second row (#334; the look #330 picked, its
  // variant B): "Wie war's?" with the Member's Vote, which a thumb changes
  // without closing the toast, and "Kommentieren".
  howWasIt?: ToastHowWasIt
  // How long it stays, in ms.
  duration: number
}

export interface ToastHowWasIt {
  comment: ToastAction
  // Without it, for a Dish cooked into another Board's Gekocht Column,
  // only "Kommentieren" (which opens it there) is offered.
  vote?: {
    // The Member's Vote now: thumbs up (true), down (false), or none.
    mine: () => boolean | null
    set: (up: boolean | null) => void
  }
}

export interface ToastAction {
  label: string
  run: () => void
}

// How long "Rückgängig" is offered (handoff: Toast, 5s undo window).
export const UNDO_WINDOW_MS = 5000
// How long a notice without actions stays: long enough to read a sentence.
export const NOTICE_MS = 8000
