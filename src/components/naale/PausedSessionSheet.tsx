'use client'

import { useEffect, useState } from 'react'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { t } from '@/lib/dev-i18n'

/**
 * "Your practice is paused" — the in-session, same-tab counterpart to
 * ResumeSessionSheet's cross-session Resume/Start Over prompt
 * (naale-explicit-pause-resume). Deliberately one action, not two: nothing
 * here was abandoned, so there's no Start Over to offer — just a moment the
 * student confirms before the clock restarts.
 */
export function PausedSessionSheet({
  secondsRemaining,
  onConfirm,
}: {
  secondsRemaining: number
  onConfirm: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [resuming, setResuming] = useState(false)

  // One frame at the closed position, then animate in. Unlike
  // ResumeSessionSheet, this sheet never animates itself back out — the
  // parent only unmounts it once resumeClock() has actually succeeded.
  useEffect(() => {
    const id = setTimeout(() => setOpen(true), 16)
    return () => clearTimeout(id)
  }, [])

  // Rounded UP — same reasoning as ResumeSessionSheet's clock: showing "0:59"
  // to someone who has 0:59.4 reads as the app having taken time off them.
  const mins = Math.floor(secondsRemaining / 60)
  const secs = secondsRemaining % 60
  const clock = `${mins}:${String(secs).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-lg transition-all duration-200 motion-reduce:transition-none ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paused-session-title"
        className={`relative w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-2xl shadow-xl px-5 pt-3 pb-6 sm:p-6 outline-none flex flex-col gap-4 transition-all duration-200 ease-out motion-reduce:transition-none ${
          open
            ? 'translate-y-0 opacity-100 sm:scale-100'
            : 'translate-y-full opacity-0 sm:translate-y-2 sm:scale-95'
        }`}
      >
        <span className="sm:hidden self-center w-10 h-1 rounded-full bg-card-border" aria-hidden />

        <h2 id="paused-session-title" className="text-xl font-extrabold text-fg">
          {t('התרגול מושהה')}
        </h2>

        <p className="text-sm text-fg/65 leading-relaxed">
          {t('נותרו')} <LtrIsolate>{clock}</LtrIsolate>
        </p>

        {/* No Escape-to-close and no backdrop-click-to-close, unlike
            ResumeSessionSheet — this isn't a dismissible choice between two
            paths, it's a required gate before the clock can restart, so
            there is nothing to dismiss it to. */}
        <button
          type="button"
          onClick={async () => { setResuming(true); await onConfirm() }}
          disabled={resuming}
          className="w-full min-h-[44px] py-3 rounded-2xl bg-accent-naale text-white font-bold hover:brightness-110 disabled:opacity-60 transition"
        >
          {t('המשך')}
        </button>
      </div>
    </div>
  )
}
