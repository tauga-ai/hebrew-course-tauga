'use client'

interface OpenAnswerInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  wordLimit: number
  loading: boolean
  disabled?: boolean
}

/**
 * Shared by all AI-graded free-text exercises — a textarea with a live word
 * counter, submit disabled past the limit or while grading, and a loading
 * state between submit and the score arriving. Each exercise screen owns its
 * own question content above this and its own score/feedback display below
 * it.
 */
export function OpenAnswerInput({ value, onChange, onSubmit, wordLimit, loading, disabled }: OpenAnswerInputProps) {
  const wordCount = value.trim() === '' ? 0 : value.trim().split(/\s+/).length
  const overLimit = wordCount > wordLimit

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
        {wordCount}/{wordLimit}
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || loading || overLimit || value.trim() === ''}
        className="mt-2 w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
      >
        {loading ? 'בודק את התשובה שלך...' : 'שלח תשובה'}
      </button>
    </div>
  )
}
