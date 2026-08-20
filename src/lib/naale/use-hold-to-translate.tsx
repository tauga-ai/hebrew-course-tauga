'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '@/lib/dev-i18n'

/** Mouse: a short dwell before translating, so sweeping the cursor across a
 *  sentence doesn't fire a lookup per word. Short enough to feel instant —
 *  Noam's complaint was that press-and-hold felt slow. */
const HOVER_DWELL_MS = 180
/** Touch/pen: hover doesn't exist, so the original press-and-hold stays bound
 *  for those pointer types. */
const HOLD_MS = 450

/** Noam, 2026-08-20: the tip slides in at the start of a session, stays for
 *  exactly 10s, then fades — with an X for students who already know. */
const TIP_VISIBLE_MS = 10_000
const TIP_FADE_MS = 400

// A Hebrew word (letters + niqqud + internal geresh/gershayim, e.g. בג"ץ),
// capturing trailing non-Hebrew punctuation separately so it renders
// outside the interactive span untouched.
const HEBREW_WORD_RE = /^([֑-״]+)([^֑-״]*)$/

interface PopoverState {
  visible: boolean
  limited: boolean
  text: string
  left: number
  top: number
}

/**
 * Shared word-translation behavior for both the practice session
 * (session/page.tsx) and the placement quiz (placement/page.tsx) — same
 * gesture, same session-scoped translation cap either way, since both screens
 * write to the same naale_sessions row shape.
 *
 * TWO TRIGGERS, SPLIT BY POINTER TYPE, and the split is load-bearing:
 *
 *  - **Mouse → hover** (Noam, 2026-08-20: *"let's go with hover only"*).
 *    Click was rejected outright because words inside MCQ answer options are
 *    translatable too, and clicking an option is how a student submits it —
 *    click-to-translate and pick-this-answer would be the same gesture.
 *    Hover has no such collision, so it deliberately does NOT set
 *    justTranslatedRef: a mouse click on an option must still submit
 *    normally, even if the student translated a word in it first.
 *  - **Touch/pen → press-and-hold**, unchanged. Hover cannot exist on touch,
 *    so "hover only" settles hover-vs-click, not hover-vs-touch. A hold DOES
 *    set justTranslatedRef, since on touch the hold ends in a tap the option
 *    button would otherwise treat as an answer.
 */
export function useHoldToTranslate(sessionId: string | null) {
  const [popover, setPopover] = useState<PopoverState | null>(null)
  // 'entering' drives the slide-in transition; 'gone' unmounts it entirely so
  // a faded tip can never sit invisibly over the page swallowing clicks.
  const [tipPhase, setTipPhase] = useState<'entering' | 'visible' | 'fading' | 'gone'>('entering')
  // QA-only — never shown to real students (see the debugMode-gated badge in
  // session/page.tsx and placement/page.tsx). Null until the first
  // translate attempt of this session actually resolves.
  const [debugUsage, setDebugUsage] = useState<{ used: number; cap: number } | null>(null)
  const gestureTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const justTranslatedRef = useRef(false)

  // The tip is per-session, not per-student: it reappears every time a session
  // starts (Noam confirmed), so there's deliberately no localStorage flag here
  // the way there used to be.
  useEffect(() => {
    if (tipPhase === 'gone') return
    const delay = tipPhase === 'entering' ? 16 : tipPhase === 'visible' ? TIP_VISIBLE_MS : TIP_FADE_MS
    const next = tipPhase === 'entering' ? 'visible' : tipPhase === 'visible' ? 'fading' : 'gone'
    const id = setTimeout(() => setTipPhase(next), delay)
    return () => clearTimeout(id)
  }, [tipPhase])

  const dismissTip = useCallback(() => {
    setTipPhase(phase => (phase === 'gone' ? phase : 'fading'))
  }, [])

  const runTranslate = useCallback(async (word: string, span: HTMLElement) => {
    dismissTip()
    if (!sessionId) return
    const rect = span.getBoundingClientRect()
    try {
      const res = await fetch('/api/naale/session/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, word }),
      })
      const data = await res.json()
      if (!res.ok) return
      if (typeof data.used === 'number' && typeof data.cap === 'number') {
        setDebugUsage({ used: data.used, cap: data.cap })
      }
      setPopover({
        visible: true,
        limited: !!data.limited,
        // "You've reached this session's translation limit" / the actual translation
        text: data.limited ? t('הגעת למגבלת התרגומים למפגש זה') : data.translation,
        left: rect.left + rect.width / 2,
        top: rect.top,
      })
      setTimeout(() => setPopover(p => (p ? { ...p, visible: false } : p)), 1800)
    } catch {
      // Best-effort UI feature — a network hiccup just means no popover this
      // time, not an error surfaced to the student.
    }
  }, [sessionId, dismissTip])

  const clearGestureTimer = useCallback(() => {
    if (gestureTimer.current) {
      clearTimeout(gestureTimer.current)
      gestureTimer.current = null
    }
  }, [])

  const bindWord = useCallback((word: string) => ({
    onPointerEnter: (e: React.PointerEvent<HTMLSpanElement>) => {
      if (e.pointerType !== 'mouse') return
      const span = e.currentTarget
      clearGestureTimer()
      gestureTimer.current = setTimeout(() => runTranslate(word, span), HOVER_DWELL_MS)
    },
    onPointerDown: (e: React.PointerEvent<HTMLSpanElement>) => {
      // Mouse is handled by hover above; binding hold here too would fire a
      // second lookup for the same word on every click.
      if (e.pointerType === 'mouse') return
      const span = e.currentTarget
      gestureTimer.current = setTimeout(() => {
        justTranslatedRef.current = true
        runTranslate(word, span)
      }, HOLD_MS)
    },
    onPointerUp: clearGestureTimer,
    onPointerLeave: clearGestureTimer,
    onPointerCancel: clearGestureTimer,
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
  }), [runTranslate, clearGestureTimer])

  /** Splits `text` into per-word spans; whitespace and stray non-Hebrew
   *  tokens (numbers, the "___" blank, etc.) render as plain, inert text. */
  const renderText = useCallback((text: string) => (
    text.split(/(\s+)/).map((part, i) => {
      if (part === '' || /^\s+$/.test(part)) return part
      const match = part.match(HEBREW_WORD_RE)
      if (!match) return <span key={i}>{part}</span>
      const [, core, trailing] = match
      return (
        <span key={i}>
          <span
            // Static affordance (dotted underline + pointer cursor) marks
            // every word as translatable. hover: is now the trigger itself on
            // mouse, not just a cue; active: recolors the word's own text
            // while held, so the ~450ms touch hold reads as "this word is
            // actively translating" rather than nothing happening.
            className="cursor-pointer select-none rounded underline decoration-dotted decoration-accent-naale/40 underline-offset-4 transition-colors hover:bg-accent-naale/10 active:bg-accent-naale/20 active:text-accent-naale"
            style={{ touchAction: 'manipulation' }}
            tabIndex={0}
            {...bindWord(core)}
          >
            {core}
          </span>
          {trailing}
        </span>
      )
    })
  ), [bindWord])

  /** Called from an MCQ button's onClick, first thing: returns true (and
   *  resets itself) if this click is the tail end of a completed touch hold,
   *  so the caller can skip selecting an answer that hold wasn't meant to
   *  submit. Never true for a mouse hover, which produces no click at all. */
  const consumeJustTranslated = useCallback(() => {
    if (justTranslatedRef.current) { justTranslatedRef.current = false; return true }
    return false
  }, [])

  const popoverElement = popover && (
    <div
      className={`fixed z-50 -translate-x-1/2 -translate-y-full -mt-2 px-2.5 py-1.5 rounded-lg text-sm text-white shadow-lg transition-opacity ${popover.visible ? 'opacity-100' : 'opacity-0'} ${popover.limited ? 'bg-red-600' : 'bg-gray-900 dark:bg-gray-700'}`}
      style={{ left: popover.left, top: popover.top }}
    >
      {popover.text}
    </div>
  )

  const hintElement = tipPhase !== 'gone' && (
    // Top corner on the reading-END side — left in the real RTL page, right in
    // the dev-only LTR one. That's the side the Hebrew text flows away from,
    // so the toast sits over empty space instead of the question, and can stay
    // fully opaque rather than being dimmed to see through it. Slides down
    // from above. z-40 keeps it under the translation popover (z-50), which
    // can overlap it near the top edge.
    <div
      role="status"
      className={`fixed top-6 end-6 z-40 w-[min(20rem,calc(100vw-3rem))] rounded-xl border border-accent-naale/30 bg-card px-4 py-3 shadow-lg transition-all duration-300 ${
        tipPhase === 'visible' ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
      }`}
    >
      <button
        type="button"
        onClick={dismissTip}
        // "Close" — for students who already know the feature and don't want
        // to wait out the 10 seconds.
        aria-label={t('סגירה')}
        className="absolute top-1 end-1 rounded p-1 text-fg/40 transition-colors hover:text-fg"
      >
        ✕
      </button>
      {/* Both languages, stacked: there is no Russian UI locale to switch on,
          and these are beginner Hebrew learners who read Russian.
          NOTE: this wording is Noam's verbatim copy, written before the
          trigger changed from click to hover — "click any word" now describes
          the wrong gesture, and on an MCQ option a click submits the answer.
          Flagged with him; swap both lines here if he confirms new wording. */}
      <div className="flex items-start gap-2.5 pe-5">
        {/* Decorative: both lines already open with "tip"/"подсказка", so the
            bulb is aria-hidden rather than read out twice. */}
        <span aria-hidden="true" className="shrink-0 text-lg leading-6">💡</span>
        <div>
          <p className="text-sm text-fg/80">{t('טיפ: לחצו על כל מילה כדי לראות את התרגום שלה.')}</p>
          <p className="text-sm text-fg/60" lang="ru">Подсказка: нажмите на любое слово, чтобы увидеть его перевод.</p>
        </div>
      </div>
    </div>
  )

  return { renderText, consumeJustTranslated, popoverElement, hintElement, debugUsage }
}
