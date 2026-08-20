'use client'

import { useEffect, useRef, useState } from 'react'
import { t } from '@/lib/dev-i18n'
import { REPORT_NOTE_MAX_LENGTH } from '@/lib/naale/question-reports'

interface ReportQuestionModalProps {
  questionId: string
  sessionId: string | null
  onClose: () => void
}

/**
 * "Found a mistake in this question? Report it to us" (N4).
 *
 * Deliberately sends only the question id, the session id and the note — the
 * server looks up the topic, difficulty, prompt text and the student's own
 * answer itself. A report is an incident record, and one assembled from
 * client-supplied content would record whatever the client claimed.
 */
export function ReportQuestionModal({ questionId, sessionId, onClose }: ReportQuestionModalProps) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Closes itself once the student has seen the confirmation, so reporting
  // doesn't cost them a second click in the middle of a timed session.
  useEffect(() => {
    if (!sent) return
    const id = setTimeout(onClose, 1600)
    return () => clearTimeout(id)
  }, [sent, onClose])

  const submit = async () => {
    if (!note.trim() || submitting) return
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

  const overLimit = note.length > REPORT_NOTE_MAX_LENGTH

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
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
        className="w-full max-w-md rounded-2xl border border-card-border bg-card p-5 shadow-xl"
      >
        {sent ? (
          // "Thanks! The report has been sent."
          <p className="py-6 text-center font-semibold text-fg">✅ {t('תודה! הדיווח נשלח.')}</p>
        ) : (
          <>
            {/* "Please describe what's wrong with the question:" */}
            <p className="mb-3 font-semibold text-fg">{t('אנא פרטו מה הטעות בשאלה:')}</p>
            <textarea
              ref={textareaRef}
              value={note}
              onChange={e => { setNote(e.target.value); if (error) setError('') }}
              dir="rtl"
              rows={4}
              maxLength={REPORT_NOTE_MAX_LENGTH}
              className="w-full resize-none rounded-xl border border-card-border bg-surface p-3 text-fg focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-70"
              disabled={submitting}
            />
            <div className={`mt-1 text-left text-xs ${overLimit ? 'text-red-500' : 'text-fg/50'}`}>
              {note.length}/{REPORT_NOTE_MAX_LENGTH}
            </div>

            {error && <p className="mt-2 text-right text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !note.trim() || overLimit}
                className="flex-1 rounded-xl bg-primary-600 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {/* "Send report" */}
                {submitting ? t('שולח…') : t('שלח דיווח')}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-xl border border-card-border px-4 py-3 font-semibold text-fg/70 transition hover:text-fg disabled:opacity-50"
              >
                {/* "Cancel" */}
                {t('ביטול')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
