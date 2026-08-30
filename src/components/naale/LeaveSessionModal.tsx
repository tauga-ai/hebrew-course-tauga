'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '@/lib/dev-i18n'

/** Same duration convention as ResumeSessionSheet/StartSessionSheet. */
const SHEET_MS = 220

/**
 * In-app replacement for the native `window.confirm()` shown when a student
 * clicks "← Back" mid-way through a Practice/Placement session
 * (naale-session-leave-warning-modal). Topic sessions never render this —
 * they bank their clock and pause safely on the way out, so there's nothing
 * to warn about.
 */
export function LeaveSessionModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
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
    setOpen(false)
    setTimeout(onCancel, SHEET_MS)
  }, [onCancel])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

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
        aria-labelledby="leave-session-title"
        tabIndex={-1}
        className={`relative w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-2xl shadow-xl px-5 pt-3 pb-6 sm:p-6 outline-none flex flex-col gap-4 transition-all duration-200 ease-out motion-reduce:transition-none ${
          open
            ? 'translate-y-0 opacity-100 sm:scale-100'
            : 'translate-y-full opacity-0 sm:translate-y-2 sm:scale-95'
        }`}
      >
        <span className="sm:hidden self-center w-10 h-1 rounded-full bg-card-border" aria-hidden />

        <h2 id="leave-session-title" className="text-xl font-extrabold text-fg">
          {t('אם תעזוב/י עכשיו יתכן שתאבד/י התקדמות בתרגול. לצאת בכל זאת?')}
        </h2>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full min-h-[44px] py-3 rounded-2xl bg-accent-naale text-white font-bold hover:brightness-110 transition"
          >
            {t('לצאת')}
          </button>
          <button
            type="button"
            onClick={close}
            className="w-full min-h-[44px] py-3 rounded-2xl border border-card-border text-fg/70 font-semibold hover:text-fg transition"
          >
            {t('ביטול')}
          </button>
        </div>
      </div>
    </div>
  )
}
