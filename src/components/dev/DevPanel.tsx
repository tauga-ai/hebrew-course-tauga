'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { getDevLang, setDevLang, subscribeDevLang } from '@/lib/dev-i18n'
import { getShowHint, setShowHint, subscribeShowHint } from '@/lib/dev-hint'
import {
  DEV_SESSION_MINUTES_COOKIE,
  getSessionMinutesOverride,
  setSessionMinutesOverride,
  subscribeSessionMinutesOverride,
} from '@/lib/naale/dev-fast-session'

interface ActiveSession {
  session_id: string
  deadline_at: string
  kind: string
  answered_count: number
}

/**
 * Dev-only. Renders only because layout.tsx wraps this in {debugMode && ...}.
 * Replaces the old DevLangToggle's direct-toggle button with a floating
 * button that opens a dialog, so more than one dev QA tool (language/RTL,
 * answer hints, the Naale session/progress tools below) can live behind one
 * button instead of stacking several.
 * Lives outside DevLangProvider's remount boundary so the button itself
 * never disappears mid-toggle.
 *
 * The Naale-specific tools below (session-state, force-expire,
 * auto-complete, reset-progress, set-topic-level, seed-review) all call
 * debug-only routes under src/app/api/naale/dev/ that independently check
 * debugMode and resolve identity server-side via getNaaleSession() — this
 * component being visible is never itself an authorization boundary.
 * They're shown unconditionally (not gated on the current page being a
 * Naale route, same as the pre-existing session-length override above them)
 * — on a non-Naale page they'll just 401, which is an acceptable dead end
 * for a dev-only tool rather than something worth a pathname check.
 */
export function DevPanel() {
  const lang = useSyncExternalStore(subscribeDevLang, getDevLang, getDevLang)
  const showHint = useSyncExternalStore(subscribeShowHint, getShowHint, getShowHint)
  const sessionMinutesOverride = useSyncExternalStore(
    subscribeSessionMinutesOverride,
    getSessionMinutesOverride,
    getSessionMinutesOverride
  )
  const [open, setOpen] = useState(false)

  const [activeSession, setActiveSession] = useState<ActiveSession | null | undefined>(undefined)
  const [topics, setTopics] = useState<string[]>([])
  const [levelTopic, setLevelTopic] = useState('')
  const [levelValue, setLevelValue] = useState(3)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  // DevLangProvider restores dev-lang's cookie on mount itself (it needs to,
  // for the remount-key trick). The hint and session-length toggles have no
  // such provider, so they restore their own persisted value here instead.
  useEffect(() => {
    const hintMatch = document.cookie.match(/(?:^|; )dev-hint=(0|1)/)
    if (hintMatch) setShowHint(hintMatch[1] === '1')
    const minutesMatch = document.cookie.match(new RegExp(`(?:^|; )${DEV_SESSION_MINUTES_COOKIE}=([0-9]+)`))
    if (minutesMatch) setSessionMinutesOverride(Number(minutesMatch[1]))
  }, [])

  async function refreshSessionState() {
    try {
      const res = await fetch('/api/naale/dev/session-state')
      const data = await res.json()
      setActiveSession(res.ok ? data.active : null)
    } catch {
      setActiveSession(null)
    }
  }

  // Best-effort, same pattern as NaaleHome's rewards fetch: only populates
  // the topic dropdown for the level-override tool, never blocks the panel.
  async function refreshTopics() {
    try {
      const res = await fetch('/api/naale/my-stats')
      if (!res.ok) return
      const data = await res.json()
      const names: string[] = (data.topics ?? []).map((t: { topic: string }) => t.topic)
      setTopics(names)
      if (names.length > 0) setLevelTopic(prev => prev || names[0])
    } catch {
      // Non-Naale page, or no student — leave the dropdown empty, harmless.
    }
  }

  // Deferred via setTimeout rather than called directly: this repo's
  // react-hooks/set-state-in-effect lint rule treats a same-tick call to an
  // external state-setting function as synchronous within the effect,
  // regardless of that function's own internal await — a genuine callback
  // boundary is what it wants instead (same rationale as naale/session/
  // page.tsx's countdown-expiry effect).
  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => {
      refreshSessionState()
      refreshTopics()
    }, 0)
    return () => clearTimeout(id)
  }, [open])

  async function runAction(label: string, run: () => Promise<Response>) {
    setBusy(label)
    setMessage(null)
    try {
      const res = await run()
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ text: data.error ?? `${label} failed`, isError: true })
      } else {
        setMessage({ text: summarize(label, data), isError: false })
        await refreshSessionState()
      }
    } catch {
      setMessage({ text: `${label} failed (network error)`, isError: true })
    } finally {
      setBusy(null)
    }
  }

  function summarize(label: string, data: Record<string, unknown>): string {
    if (label === 'reset') {
      const d = data.deleted as Record<string, number>
      return `Reset: ${d.naale_answers} answers, ${d.naale_sessions} sessions, ${d.naale_topic_levels} levels deleted`
    }
    if (label === 'force-expire') return 'Session deadline set to now'
    if (label === 'auto-complete') return 'Session marked completed'
    if (label === 'set-level') return `${data.topic}: level set to ${data.level}`
    if (label === 'seed-review') return `Seeded a review question for "${data.topic}"`
    return 'Done'
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-4 z-50 rounded-full bg-gray-800 px-3 py-2 text-xs font-medium text-white shadow-lg hover:bg-gray-700 ${lang === 'he' ? 'left-4' : 'right-4'}`}
      >
        {lang === 'he' ? 'EN' : 'עב'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm max-h-[85vh] overflow-y-auto bg-surface border border-card-border rounded-2xl p-4 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-fg">Dev QA tools</span>
              <button type="button" onClick={() => setOpen(false)} className="text-fg/40 hover:text-fg/70 text-sm px-2">
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-card-border">
              <span className="text-sm text-fg">Language / RTL</span>
              <button
                type="button"
                onClick={() => setDevLang(lang === 'he' ? 'en' : 'he')}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-800 text-white hover:bg-gray-700"
              >
                {lang === 'he' ? 'Switch to EN' : 'Switch to HE'}
              </button>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-card-border">
              <div>
                <div className="text-sm text-fg">Show answer hints</div>
                <div className="text-xs text-fg/50">Naale session questions only</div>
              </div>
              <button
                type="button"
                onClick={() => setShowHint(!showHint)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                  showHint ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-white/10 text-fg/70'
                }`}
              >
                {showHint ? 'On' : 'Off'}
              </button>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-card-border">
              <div>
                <div className="text-sm text-fg">Session length override</div>
                <div className="text-xs text-fg/50">minutes — next session you start; blank = real 30</div>
              </div>
              <input
                type="number"
                min={1}
                placeholder="30"
                value={sessionMinutesOverride ?? ''}
                onChange={e => {
                  const raw = e.target.value
                  const n = raw === '' ? NaN : Number(raw)
                  setSessionMinutesOverride(Number.isFinite(n) && n > 0 ? n : null)
                }}
                className="w-16 text-xs font-medium px-2 py-1.5 rounded-full bg-gray-200 dark:bg-white/10 text-fg text-center"
              />
            </div>

            <div className="pt-3 border-t border-card-border">
              <div className="text-sm text-fg mb-2">Naale session tools</div>

              <div className="text-xs text-fg/60 bg-gray-100 dark:bg-white/5 rounded-lg p-2 mb-2 font-mono break-all">
                {activeSession === undefined && 'loading…'}
                {activeSession === null && 'no active session'}
                {activeSession && (
                  <>
                    id: {activeSession.session_id}
                    <br />
                    kind: {activeSession.kind}, answered: {activeSession.answered_count}
                    <br />
                    deadline: {activeSession.deadline_at}
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy !== null || !activeSession}
                  onClick={() => runAction('force-expire', () => fetch('/api/naale/dev/force-expire', { method: 'POST' }))}
                  className="flex-1 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40"
                >
                  Force-expire now
                </button>
                <button
                  type="button"
                  disabled={busy !== null || !activeSession}
                  onClick={() => runAction('auto-complete', () => fetch('/api/naale/dev/auto-complete', { method: 'POST' }))}
                  className="flex-1 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40"
                >
                  Auto-complete
                </button>
              </div>
            </div>

            <div className="py-3 border-t border-card-border">
              <div className="text-sm text-fg mb-2">Naale progress tools</div>

              <div className="flex items-center gap-2 mb-2">
                {topics.length > 0 ? (
                  <select
                    value={levelTopic}
                    onChange={e => setLevelTopic(e.target.value)}
                    className="flex-1 min-w-0 text-xs px-2 py-1.5 rounded-full bg-gray-200 dark:bg-white/10 text-fg"
                  >
                    {topics.map(topicName => (
                      <option key={topicName} value={topicName}>
                        {topicName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="topic name"
                    value={levelTopic}
                    onChange={e => setLevelTopic(e.target.value)}
                    className="flex-1 min-w-0 text-xs px-2 py-1.5 rounded-full bg-gray-200 dark:bg-white/10 text-fg"
                  />
                )}
                <select
                  value={levelValue}
                  onChange={e => setLevelValue(Number(e.target.value))}
                  className="text-xs px-2 py-1.5 rounded-full bg-gray-200 dark:bg-white/10 text-fg"
                >
                  {[1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>
                      lvl {n}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy !== null || !levelTopic}
                  onClick={() =>
                    runAction('set-level', () =>
                      fetch('/api/naale/dev/set-topic-level', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ topic: levelTopic, level: levelValue }),
                      })
                    )
                  }
                  className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40"
                >
                  Set
                </button>
              </div>

              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => runAction('seed-review', () => fetch('/api/naale/dev/seed-review', { method: 'POST' }))}
                  className="flex-1 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40"
                >
                  Seed a review question
                </button>
              </div>
              <div className="text-xs text-fg/40 mb-2">
                Seeding leaves a real (synthetic) wrong-answer row behind — never mistake it for genuine history.
              </div>

              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  if (!window.confirm('Reset ALL of your own Naale progress? This deletes your levels, sessions, and answers.')) return
                  runAction('reset', () => fetch('/api/naale/dev/reset-progress', { method: 'POST' }))
                }}
                className="w-full text-xs font-medium px-3 py-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
              >
                Reset my progress
              </button>
            </div>

            {message && (
              <div className={`text-xs pt-2 ${message.isError ? 'text-red-500 dark:text-red-400' : 'text-fg/60'}`}>
                {message.text}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
