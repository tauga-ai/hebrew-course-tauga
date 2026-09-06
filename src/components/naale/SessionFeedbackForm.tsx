'use client'

import { useState } from 'react'
import { t } from '@/lib/dev-i18n'

const RATING_VALUES = [1, 2, 3, 4, 5]

function RatingRow({ label, value, onChange }: { label: string; value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-medium text-fg/80 mb-2 text-right">{label}</p>
      <div className="flex gap-2 justify-center">
        {RATING_VALUES.map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-10 h-10 rounded-full text-sm font-semibold transition ${
              value === n
                ? 'bg-primary-600 text-white'
                : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * naale-session-feedback-popup: shown in place of the score/stats recap on a
 * student's 2nd completed practice session — see session/page.tsx's
 * `summary.feedback_required` branch for the gate. Submitting flips the
 * caller back to the normal recap; there is no way to see the score without
 * submitting this first (see task.md §1 for why that's a UI-order gate, not
 * a security one).
 */
export function SessionFeedbackForm({ sessionId, onSubmitted }: { sessionId: string; onSubmitted: () => void }) {
  const [questionQuality, setQuestionQuality] = useState<number | null>(null)
  const [interfaceRating, setInterfaceRating] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!questionQuality || !interfaceRating) {
      setError(t('נא לדרג את שתי השאלות לפני השליחה'))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/naale/session/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          question_quality: questionQuality,
          interface_rating: interfaceRating,
          suggestions: suggestions.trim() || undefined,
        }),
      })
      if (!res.ok) {
        setError(t('השליחה נכשלה, נסו שוב'))
        return
      }
      onSubmitted()
    } catch {
      setError(t('השליחה נכשלה, נסו שוב'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-8">
      <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-6">
        <h2 className="text-lg font-bold text-fg mb-1 text-center">{t('רגע לפני התוצאה...')}</h2>
        <p className="text-sm text-fg/60 mb-6 text-center">{t('נשמח לדעת מה חשבתם על התרגול')}</p>

        <RatingRow label={t('איך הייתה איכות השאלות?')} value={questionQuality} onChange={setQuestionQuality} />
        <RatingRow label={t('איך היה ממשק התרגול?')} value={interfaceRating} onChange={setInterfaceRating} />

        <div className="mb-5">
          <p className="text-sm font-medium text-fg/80 mb-2 text-right">{t('הצעות לשיפור (לא חובה)')}</p>
          <textarea
            value={suggestions}
            onChange={e => setSuggestions(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full border border-card-border rounded-xl px-4 py-3 text-right resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 bg-surface text-fg"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3 text-right">{error}</p>}

        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? t('שולח…') : t('שליחה וצפייה בתוצאה')}
        </button>
      </div>
    </div>
  )
}
