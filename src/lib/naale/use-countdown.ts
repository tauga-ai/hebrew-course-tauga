'use client'

import { useEffect, useState } from 'react'

/**
 * Seconds remaining until an absolute deadline.
 *
 * Derived from the deadline on every tick rather than decremented: a
 * background-throttled tab resyncs instead of drifting, and a page reload can't
 * extend the session. The deadline comes from naale_sessions.deadline_at, which
 * the server computes — the client is purely a renderer here.
 *
 * Returns null while the deadline is unknown (e.g. before the session loads).
 */
// A plain helper, not a hook — the same shape as timeAgo() in
// LiveMonitorBoard.tsx, this repo's existing precedent for reading Date.now()
// from render. React Compiler's purity check only analyzes hooks/components
// themselves, so the impure read has to live outside useCountdown's own body.
function secondsUntil(deadlineMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000))
}

export function useCountdown(deadlineMs: number | null): number | null {
  // A dummy counter, bumped once a second purely to force a re-render — the
  // actual remaining-seconds value is computed fresh below on every render
  // rather than stored in state, so there's nothing to keep in sync and
  // nothing to reset when deadlineMs becomes null. setState only happens
  // inside the interval callback, never synchronously in the effect body.
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (deadlineMs === null) return
    const id = setInterval(() => forceTick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [deadlineMs])

  if (deadlineMs === null) return null
  return secondsUntil(deadlineMs)
}

/** MM:SS. Must be rendered inside <LtrIsolate> — LTR digits in RTL prose. */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
