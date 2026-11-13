// How a line or a group leaves, and how a line coming back opens its slot
// (#536, R15): on a desktop a removed line slides left and fades, then its
// slot closes; a phone's swipe has already taken the row away, so only the
// slot closes; "Erledigte entfernen" fades the ticked lines one after another,
// then closes their slots. Pure plans (tested without a browser), and the
// players that run them with the Web Animations API.

import { motionEase, prefersReducedMotion } from './motion'

// A slot (of a line or a group) closes, or opens, in this long: the handoff's
// settle, which is not one of the motion tokens.
export const SLOT_MS = 380
// A desktop removal: the line slides this far left and fades in this long
// (ease-in), and its slot starts closing this long after the removal.
export const REMOVE_SLIDE_PX = 24
export const REMOVE_FADE_MS = 200
export const REMOVE_COLLAPSE_MS = 180
// "Erledigte entfernen": each ticked line fades in this long, one STEP_MS
// after the one above it, and its slot closes COLLAPSE_MS after its own fade
// starts.
export const CLEAR_FADE_MS = 160
export const CLEAR_STEP_MS = 30
export const CLEAR_COLLAPSE_MS = 140
// Under reduced motion every fade is this long (the handoff's --dur-fade with
// reduced motion), and nothing slides or collapses.
export const REDUCED_FADE_MS = 200

export type LeaveKind = 'swipe' | 'remove' | 'clear'

export interface LeavePlan {
  // The row slides left as it fades (a desktop removal).
  slide: boolean
  // The fade: when it starts, how long it takes, and its easing. Null: no fade.
  fade: { delay: number, duration: number, easing: 'ease-in' | 'fade' } | null
  // When the slot starts closing, or null for no collapse.
  collapse: number | null
}

// The plan for a line (index is its place among the lines leaving together,
// top to bottom) or for a group (index 0).
export function leavePlan(kind: LeaveKind, index: number, reduced: boolean): LeavePlan {
  if (reduced) return { slide: false, fade: { delay: 0, duration: REDUCED_FADE_MS, easing: 'fade' }, collapse: null }
  if (kind === 'swipe') return { slide: false, fade: null, collapse: 0 }
  if (kind === 'remove') return { slide: true, fade: { delay: 0, duration: REMOVE_FADE_MS, easing: 'ease-in' }, collapse: REMOVE_COLLAPSE_MS }
  const start = index * CLEAR_STEP_MS
  return { slide: false, fade: { delay: start, duration: CLEAR_FADE_MS, easing: 'fade' }, collapse: start + CLEAR_COLLAPSE_MS }
}

// Which way an element leaves: a clear while "Erledigte entfernen" runs; a
// swipe if a row in it has been taken out of the way by a swipe; otherwise a
// removal (the trash, the Delete key, an empty edit).
export function leaveKind(element: Element, clearing: boolean): LeaveKind {
  if (clearing) return 'clear'
  return element.querySelector('.row-leaving') ? 'swipe' : 'remove'
}

// Plays a leave on `el` by its plan and resolves when it is over. `slotGap`
// is the space a group keeps below itself, which its collapse takes with it
// (a negative margin), so the groups below close up exactly.
export function playLeave(el: HTMLElement, plan: LeavePlan, slotGap = 0): Promise<void> {
  const animations: Animation[] = []
  // A leaving row takes no more presses.
  el.style.pointerEvents = 'none'
  if (plan.fade) {
    const keyframes: Keyframe[] = plan.slide
      ? [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(-${REMOVE_SLIDE_PX}px)` }]
      : [{ opacity: 1 }, { opacity: 0 }]
    animations.push(el.animate(keyframes, {
      delay: plan.fade.delay,
      duration: plan.fade.duration,
      easing: plan.fade.easing === 'fade' ? motionEase('fade') : 'ease-in',
      fill: 'forwards',
    }))
  }
  if (plan.collapse !== null) {
    // The content below the slot's edge is hidden as the slot closes.
    el.style.overflow = 'hidden'
    const height = el.offsetHeight
    animations.push(el.animate(
      [
        { height: `${height}px`, marginBottom: '0px' },
        { height: '0px', marginBottom: `-${slotGap}px` },
      ],
      { delay: plan.collapse, duration: SLOT_MS, easing: motionEase('settle'), fill: 'forwards' },
    ))
  }
  return Promise.allSettled(animations.map(animation => animation.finished)).then(() => undefined)
}

// Plays a group leaving with its last line: its lines leave as lines do (the
// group's own removal means their own hooks never run), then the group's slot
// closes. `gap` is the space the group keeps below itself.
export function playGroupLeave(section: HTMLElement, clearing: boolean, gap: number): Promise<void> {
  const kind = leaveKind(section, clearing)
  const reduced = prefersReducedMotion()
  const lines = [...section.querySelectorAll<HTMLElement>(':scope > ul > li')]
    .map((line, index) => playLeave(line, { ...leavePlan(kind, index, reduced), collapse: null }))
  const slot = playLeave(section, { slide: false, fade: null, collapse: leavePlan(kind, 0, reduced).collapse }, gap)
  return Promise.all([slot, ...lines]).then(() => undefined)
}

// Plays a line coming back (Rückgängig, or a line typed in): its slot opens
// to its height and the row arrives (the CSS class does that), in SLOT_MS.
// Reduced motion: a fade. Resolves when both are over, the CSS arrival too.
export function playEnter(el: HTMLElement): Promise<void> {
  if (prefersReducedMotion()) {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE_MS, easing: motionEase('fade') })
  }
  else {
    const height = el.offsetHeight
    el.style.overflow = 'hidden'
    el.animate([{ height: '0px' }, { height: `${height}px` }], { duration: SLOT_MS, easing: motionEase('settle') })
  }
  return Promise.allSettled(el.getAnimations().map(animation => animation.finished)).then(() => {
    el.style.overflow = ''
  })
}
