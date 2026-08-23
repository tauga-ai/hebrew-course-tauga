'use client'

import { useEffect, useState } from 'react'
import { t } from '@/lib/dev-i18n'
import { wordCount } from '@/lib/naale/open-exercise-display'

interface OpenAnswerInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  wordLimit: number
  loading: boolean
  disabled?: boolean
}

const LOADING_MESSAGES = [
  'קורא את התשובה שלך…',
  'מנתח מבנה משפט…',
  'בודק שימוש במילת חובה…',
  'מסיים את הניקוד…',
]

/**
 * Shared by all AI-graded free-text exercises — a textarea with a live word
 * counter, submit disabled past the limit or while grading, and a loading
 * state between submit and the score arriving. Each exercise screen owns its
 * own question content above this and its own score/feedback display below
 * it.
 */
export function OpenAnswerInput({ value, onChange, onSubmit, wordLimit, loading, disabled }: OpenAnswerInputProps) {
  const count = wordCount(value)
  const overLimit = count > wordLimit
  const [messageIndex, setMessageIndex] = useState(0)
  const [wasLoading, setWasLoading] = useState(loading)

  // Reset to the first message whenever a new grading call starts, following
  // React's "adjust state during render" pattern instead of an effect — an
  // effect that unconditionally calls setState on prop change causes an
  // extra cascading render for no benefit here.
  if (loading !== wasLoading) {
    setWasLoading(loading)
    if (loading) setMessageIndex(0)
  }

  useEffect(() => {
    if (!loading) return
    const interval = setInterval(() => setMessageIndex(i => (i + 1) % LOADING_MESSAGES.length), 2800)
    return () => clearInterval(interval)
  }, [loading])

  return (
    <div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled || loading}
        dir="rtl"
        rows={4}
        className="w-full rounded-xl border border-card-border bg-surface p-3 text-fg resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-70"
      />
      <div className={`text-xs mt-1 text-left ${overLimit ? 'text-red-500' : 'text-fg/50'}`}>
        {count}/{wordLimit}
      </div>
      {/* Empty text does NOT disable this button — the caller's onSubmit is
          responsible for intercepting an empty value and showing its own
          validation message. A disabled button here would swallow that
          click entirely and give no feedback at all. */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || loading || overLimit}
        className="mt-2 w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            {/* All four messages share the same grid cell so the box is
                always sized to the widest one — otherwise the button's
                centered content re-centers on every message change and the
                dots visibly jump sideways. */}
            <span className="grid text-sm">
              {LOADING_MESSAGES.map((message, i) => (
                <span
                  key={message}
                  className="col-start-1 row-start-1 shimmer-text whitespace-nowrap transition-opacity duration-300"
                  style={{ opacity: i === messageIndex ? 1 : 0 }}
                >
                  {t(message)}
                </span>
              ))}
            </span>
            <span className="flex items-center gap-1">
              <span className="dot-bounce h-1.5 w-1.5 rounded-full bg-white" style={{ animationDelay: '0s' }} />
              <span className="dot-bounce h-1.5 w-1.5 rounded-full bg-white" style={{ animationDelay: '0.2s' }} />
              <span className="dot-bounce h-1.5 w-1.5 rounded-full bg-white" style={{ animationDelay: '0.4s' }} />
            </span>
          </span>
        ) : (
          t('שלח תשובה')
        )}
      </button>
    </div>
  )
}
