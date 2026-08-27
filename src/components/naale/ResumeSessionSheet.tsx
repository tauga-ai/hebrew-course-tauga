'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { t } from '@/lib/dev-i18n'

/** Kept in step with the duration classes below — the exit has to finish
 *  before the parent unmounts the sheet. Same value StartSessionSheet uses. */
const SHEET_MS = 220

/**
 * "You left a practice unfinished" — Resume or Start Over.
 *
 * Shown when a student returns to a 5-minute topic session they walked away
 * from (naale-topic-session-resume). Noam: *"if they come back later, they
 * shouldn't be forced to finish that old session... let's give them two
 * options: 'Resume' or 'Start Over'."*
 *
 * Deliberately a separate component from StartSessionSheet despite sharing its
 * bottom-sheet-on-phone / centred-dialog-on-web treatment. That sheet answers
 * "here are the terms, shall we begin"; this one answers "you left something
 * unfinished, what now". Folding two different questions into one component
 * would have meant a kind union widening again and a body of conditionals,
 * making both harder to read than either is apart.
 *
 * Neither action loses work, and the copy says so: answers already given live
 * in naale_answers, which neither branch touches. A student who picks Start
 * Over discards the session, not the XP.
 */
export function ResumeSessionSheet({
  topicName,
  secondsRemaining,
  answeredCount,
  starting,
  error,
  onResume,
  onStartOver,
  onClose,
}: {
  topicName: string | null
  secondsRemaining: number
  answeredCount: number
  starting: boolean
  error: string
  onResume: () => void
  onStartOver: () => void
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => { panelRef.current?.focus() }, [])

  // One frame at the closed position, then animate in.
  useEffect(() => {
    const id = setTimeout(() => setOpen(true), 16)
    return () => clearTimeout(id)
  }, [])

  const close = useCallback(() => {
    if (starting) return
    setOpen(false)
    setTimeout(onClose, SHEET_MS)
  }, [onClose, starting])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  // Rounded UP: showing "2:59 left" to someone who has 2:59.4 reads as the app
  // having taken time off them. mm:ss because a bare seconds count is unreadable
  // at this size.
  const mins = Math.floor(secondsRemaining / 60)
  const secs = secondsRemaining % 60
  const clock = `${mins}:${String(secs).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div
        onClick={close}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 motion-reduce:transition-none ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-session-title"
        tabIndex={-1}
        className={`relative w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-2xl shadow-xl px-5 pt-3 pb-6 sm:p-6 outline-none flex flex-col gap-4 transition-all duration-200 ease-out motion-reduce:transition-none ${
          open
            ? 'translate-y-0 opacity-100 sm:scale-100'
            : 'translate-y-full opacity-0 sm:translate-y-2 sm:scale-95'
        }`}
      >
        <span className="sm:hidden self-center w-10 h-1 rounded-full bg-card-border" aria-hidden />

        <div className="flex flex-col gap-1">
          {topicName && (
            <span className="self-start text-[10px] font-bold tracking-wide uppercase text-accent-naale border border-accent-naale/30 bg-accent-naale/10 rounded-full px-2 py-0.5">
              {t(topicName)}
            </span>
          )}
          <h2 id="resume-session-title" className="text-xl font-extrabold text-fg">
            {t('יש לך תרגול שלא הסתיים')}
          </h2>
        </div>

        {/* States the two facts that decide the choice — how much time is left,
            and that nothing already answered is at stake. The second matters
            more: without it, "Start Over" reads as throwing away work. */}
        <p className="text-sm text-fg/65 leading-relaxed">
          {t('נותרו')} <LtrIsolate>{clock}</LtrIsolate>
          {answeredCount > 0 && (
            <>
              {' · '}
              <LtrIsolate>{String(answeredCount)}</LtrIsolate> {t('תשובות נשמרו')}
            </>
          )}
        </p>

        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            disabled={starting}
            className="w-full min-h-[44px] py-3 rounded-2xl bg-accent-naale text-white font-bold hover:brightness-110 disabled:opacity-60 transition"
          >
            {t('המשך')}
          </button>
          {/* Secondary, not destructive-red: starting over loses the clock, not
              the work, and a red button would overstate the cost. */}
          <button
            type="button"
            onClick={onStartOver}
            disabled={starting}
            className="w-full min-h-[44px] py-3 rounded-2xl border border-card-border text-fg/70 font-semibold hover:text-fg disabled:opacity-60 transition"
          >
            {t('התחל מחדש')}
          </button>
        </div>
      </div>
    </div>
  )
}
