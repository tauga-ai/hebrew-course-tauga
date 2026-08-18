'use client'

import { useCallback, useRef, useState } from 'react'
import { t } from '@/lib/dev-i18n'

const HOLD_MS = 450
const HINT_DISMISSED_KEY = 'naale_translate_hint_dismissed'

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
 * Shared press-and-hold-to-translate behavior for both the practice session
 * (session/page.tsx) and the placement quiz (placement/page.tsx) — same
 * gesture, same session-scoped 30-translation cap either way, since both
 * screens write to the same naale_sessions row shape. Tokenizes a Hebrew
 * string into per-word spans, handles the hold gesture via Pointer Events
 * (mouse and touch identically), and exposes a one-shot flag so an MCQ
 * button's onClick can tell a completed hold apart from a real tap.
 */
export function useHoldToTranslate(sessionId: string | null) {
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const [hintDismissed, setHintDismissed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(HINT_DISMISSED_KEY) === '1'
  )
  // QA-only — never shown to real students (see the debugMode-gated badge in
  // session/page.tsx and placement/page.tsx). Null until the first
  // translate attempt of this session actually resolves.
  const [debugUsage, setDebugUsage] = useState<{ used: number; cap: number } | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const justTranslatedRef = useRef(false)

  const dismissHint = useCallback(() => {
    localStorage.setItem(HINT_DISMISSED_KEY, '1')
    setHintDismissed(true)
  }, [])

  const runTranslate = useCallback(async (word: string, span: HTMLElement) => {
    dismissHint()
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
  }, [sessionId, dismissHint])

  const clearHoldTimer = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  const bindWord = useCallback((word: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLSpanElement>) => {
      const span = e.currentTarget
      holdTimer.current = setTimeout(() => {
        justTranslatedRef.current = true
        runTranslate(word, span)
      }, HOLD_MS)
    },
    onPointerUp: clearHoldTimer,
    onPointerLeave: clearHoldTimer,
    onPointerCancel: clearHoldTimer,
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
  }), [runTranslate, clearHoldTimer])

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
            // every word as translatable, not just during the one-time
            // hint. hover: gives a mouse-user a cue before they even press
            // (touch has no hover state, so this is desktop-only feedback,
            // additive to the tap/hold gesture itself). active: the word's
            // text itself recolors (not just a background tint) while held,
            // so the ~450ms hold reads as "this word is actively
            // translating" rather than nothing visible happening until the
            // popover appears.
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
   *  resets itself) if this click is the tail end of a completed hold, so
   *  the caller can skip selecting an answer that hold wasn't meant to
   *  submit. */
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

  const hintElement = !hintDismissed && (
    // "Tip: holding a word shows its translation"
    <p className="text-xs text-fg/50 mb-3 text-right">{t('טיפ: לחיצה ארוכה על מילה מציגה את התרגום שלה')}</p>
  )

  return { renderText, consumeJustTranslated, popoverElement, hintElement, debugUsage }
}
