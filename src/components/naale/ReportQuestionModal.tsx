'use client'

import { useEffect, useRef, useState } from 'react'
import { t } from '@/lib/dev-i18n'
import { REPORT_NOTE_MAX_LENGTH } from '@/lib/naale/question-reports'

interface ReportQuestionModalProps {
  questionId: string
  sessionId: string | null
  onClose: () => void
}

/** Fixed reasons a student can pick without typing anything. Their Hebrew
 *  text IS the report's `note` when selected — no separate category field,
 *  since the server/staff page only ever stored free text and a new column
 *  isn't needed just to skip typing four common cases. */
const REASONS = [
  'האפשרויות ברורות מדי',
  'האפשרויות אינן רלוונטיות למה שאני לומד',
  'יש יותר מתשובה אחת נכונה',
  'התוכן בשאלה אינו הולם',
] as const

/** Sentinel for "type your own reason" — not sent as-is, `otherText` is. */
const OTHER = 'אחר'

/**
 * "Found a mistake in this question? Report it to us" (N4).
 *
 * Deliberately sends only the question id, the session id and the note — the
 * server looks up the topic, difficulty, prompt text and the student's own
 * answer itself. A report is an incident record, and one assembled from
 * client-supplied content would record whatever the client claimed.
 */
export function ReportQuestionModal({ questionId, sessionId, onClose }: ReportQuestionModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [otherText, setOtherText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Focus the free-text field the moment "Other" becomes the selected reason,
  // mirroring the old always-focus-the-textarea behavior for the one case
  // that still has a textarea to focus.
  useEffect(() => {
    if (selectedReason === OTHER) textareaRef.current?.focus()
  }, [selectedReason])

  // Closes itself once the student has seen the confirmation, so reporting
  // doesn't cost them a second click in the middle of a timed session.
  useEffect(() => {
    if (!sent) return
    const id = setTimeout(onClose, 1600)
    return () => clearTimeout(id)
  }, [sent, onClose])

  const note = selectedReason === OTHER ? otherText.trim() : (selectedReason ?? '')
  const overLimit = note.length > REPORT_NOTE_MAX_LENGTH
  const canSubmit = note.length > 0 && !overLimit

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/naale/report-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: questionId, session_id: sessionId, note }),
      })
      const data = await res.json()
      // "Sending the report failed, please try again"
      if (!res.ok) { setError(data.error || t('שליחת הדיווח נכשלה, נסו שוב')); return }
      setSent(true)
    } catch {
      setError(t('שליחת הדיווח נכשלה, נסו שוב'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      // Backdrop click closes; the stopPropagation on the panel keeps a click
      // inside the form from counting as a backdrop click.
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('דיווח על טעות בשאלה')}
        dir="rtl"
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-card-border bg-surface p-5 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label={t('סגירה')}
          className="absolute end-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-fg/50 transition-colors hover:bg-black/5 hover:text-fg disabled:opacity-50 dark:hover:bg-white/5"
        >
          ✕
        </button>

        {sent ? (
          <div className="py-6 text-center">
            {/* "Thanks! The report has been sent." */}
            <p className="mb-5 font-semibold text-fg">✅ {t('תודה! הדיווח נשלח.')}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-primary-600 px-8 py-2.5 font-semibold text-white transition hover:opacity-90"
            >
              {t('סגירה')}
            </button>
          </div>
        ) : (
          <>
            <h2 className="mb-4 pe-8 text-lg font-bold text-fg">{t('דיווח על טעות בשאלה')}</h2>

            {/* "What's the problem with the question?" */}
            <p className="mb-3 font-semibold text-fg">{t('מה הבעיה בשאלה?')}</p>

            <div role="radiogroup" aria-label={t('מה הבעיה בשאלה?')} className="space-y-2.5">
              {REASONS.map(reason => (
                <label key={reason} className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="radio"
                    name="report-reason"
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    disabled={submitting}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary-600"
                  />
                  <span className="text-sm font-medium text-fg">{t(reason)}</span>
                </label>
              ))}

              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="radio"
                  name="report-reason"
                  checked={selectedReason === OTHER}
                  onChange={() => setSelectedReason(OTHER)}
                  disabled={submitting}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary-600"
                />
                <span className="text-sm font-medium text-fg">{t(OTHER)}</span>
              </label>
            </div>

            {selectedReason === OTHER && (
              <div className="ms-[26px] mt-2">
                <textarea
                  ref={textareaRef}
                  value={otherText}
                  onChange={e => { setOtherText(e.target.value); if (error) setError('') }}
                  dir="rtl"
                  rows={3}
                  maxLength={REPORT_NOTE_MAX_LENGTH}
                  className="w-full resize-none rounded-xl border border-card-border bg-surface p-3 text-fg focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-70"
                  disabled={submitting}
                />
                <div className={`mt-1 text-left text-xs ${overLimit ? 'text-red-500' : 'text-fg/50'}`}>
                  {otherText.length}/{REPORT_NOTE_MAX_LENGTH}
                </div>
              </div>
            )}

            {error && <p className="mt-2 text-right text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !canSubmit}
                className="rounded-xl bg-primary-600 px-6 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {/* "Send report" */}
                {submitting ? t('שולח…') : t('שלח דיווח')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
