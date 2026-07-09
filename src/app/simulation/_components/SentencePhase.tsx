'use client'

import type { ReactNode } from 'react'
import type { SentenceFeedback } from '@/app/api/sentence/feedback/route'
import type { useSpeechToText } from '@/lib/hooks/use-speech-to-text'
import { scoreColor } from '@/lib/score-color'

// 2-tier (good/ok only, no "bad" tier exists on this screen) — ok: -Infinity
// makes every score below `good` fall into the ok tier instead of bad.
const sentenceCardColor = (score: number) => scoreColor(score, {
  thresholds: { good: 7, ok: -Infinity },
  palette: {
    good: 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800',
    ok: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-800',
    bad: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-800',
  },
})
const sentenceTextColor = (score: number) => scoreColor(score, {
  thresholds: { good: 7, ok: -Infinity },
  palette: { good: 'text-green-600 dark:text-green-400', ok: 'text-yellow-600 dark:text-yellow-400', bad: 'text-yellow-600 dark:text-yellow-400' },
})

interface SimExercise {
  id: number; ex_order: number
  words_json: { text: string; starred: boolean }[]
}

interface SentencePhaseProps {
  stepHeader: ReactNode
  progressBar: ReactNode
  partC: SimExercise[]
  currentEx: number
  sentenceInput: string
  setSentenceInput: (value: string) => void
  evalLoading: boolean
  currentFeedback: SentenceFeedback | null
  sentenceSpeech: ReturnType<typeof useSpeechToText>
  onSubmitSentence: () => void
  onNextSentence: () => void
  /** True while the final (last-exercise) submission is in flight. */
  submitting?: boolean
  /** Shown when the last submit attempt failed. */
  errorBanner?: ReactNode
}

/** Part C — sentence-building exercises, one at a time with AI feedback. */
export function SentencePhase({
  stepHeader, progressBar, partC, currentEx, sentenceInput, setSentenceInput,
  evalLoading, currentFeedback, sentenceSpeech, onSubmitSentence, onNextSentence,
  submitting, errorBanner,
}: SentencePhaseProps) {
  const ex = partC[currentEx]
  const words = ex?.words_json || []

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      {stepHeader}
      {progressBar}
      {errorBanner}
      <div className="text-sm text-fg/60 mb-4">תרגיל {currentEx + 1} / {partC.length}</div>

      {!currentFeedback ? (
        <>
          <div className="bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-800 rounded-xl p-3 mb-4 text-sm text-primary-800 dark:text-primary-300">
            השתמש בכל המילים <strong>★ המסומנות בכחול</strong> ובלפחות 6 מילים מהרשימה.
          </div>
          <div className="bg-surface rounded-2xl border border-card-border p-5 mb-4">
            <div className="flex flex-wrap gap-2">
              {words.map((w, i) => (
                <span key={i} className={`px-3 py-1.5 rounded-full text-sm font-medium border ${w.starred ? 'bg-primary-600 text-white border-primary-600' : 'bg-black/5 dark:bg-white/5 text-fg/80 border-card-border'}`}>
                  {w.starred ? '★ ' : ''}{w.text}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-surface rounded-2xl border border-card-border p-5 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-fg/80">המשפט שלי</span>
              <div className="flex gap-2">
                {sentenceInput && <button onClick={() => setSentenceInput('')} className="text-xs text-fg/40 hover:text-red-400 px-2 py-1">נקה</button>}
                {sentenceSpeech.supported && (
                  <button onClick={() => sentenceSpeech.isListening ? sentenceSpeech.stop() : sentenceSpeech.start(sentenceInput)}
                    className={`text-sm px-3 py-1.5 rounded-lg font-medium ${sentenceSpeech.isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-primary-100 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-500/20'}`}>
                    {sentenceSpeech.isListening ? '⏹ עצור' : '🎤 הקלט את עצמך'}
                  </button>
                )}
              </div>
            </div>
            <textarea value={sentenceInput} onChange={e => setSentenceInput(e.target.value)}
              placeholder="כתוב את המשפט שלך כאן..." rows={4}
              className="w-full border border-card-border rounded-xl px-4 py-3 text-right resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 bg-surface text-fg" />
          </div>
          <button onClick={onSubmitSentence} disabled={!sentenceInput.trim() || evalLoading}
            className="w-full bg-primary-600 text-white font-semibold py-3 rounded-xl hover:bg-primary-700 disabled:opacity-40 transition">
            {evalLoading ? 'בודק...' : 'שלח לבדיקה'}
          </button>
        </>
      ) : (
        <>
          <div className={`rounded-2xl border p-4 text-center mb-3 ${sentenceCardColor(currentFeedback.score)}`}>
            <div className={`text-4xl font-bold ${sentenceTextColor(currentFeedback.score)}`}>{currentFeedback.score}/10</div>
          </div>
          <div className="bg-surface rounded-2xl border border-card-border p-4 mb-3">
            <p className="text-xs text-fg/40 mb-1">המשפט שלך</p>
            <p className="text-fg text-sm">{sentenceInput}</p>
          </div>
          <div className="bg-surface rounded-2xl border border-card-border p-4 mb-3">
            <p className="text-sm text-fg/80">{currentFeedback.feedback}</p>
          </div>
          <div className="bg-green-50 border border-green-200 dark:bg-green-950/40 dark:border-green-800 rounded-2xl p-4 mb-4">
            <p className="text-xs text-green-600 dark:text-green-400 font-semibold mb-1">✨ גרסה מושלמת</p>
            <p className="text-green-800 dark:text-green-300 text-sm font-medium">{currentFeedback.improved_sentence}</p>
          </div>
          <button onClick={onNextSentence} disabled={submitting}
            className="w-full bg-primary-600 text-white font-semibold py-3 rounded-xl hover:bg-primary-700 disabled:opacity-40 transition">
            {submitting ? 'שולח...' : currentEx + 1 >= partC.length ? 'עבור לראיון →' : `תרגיל הבא (${currentEx + 2}/${partC.length}) →`}
          </button>
        </>
      )}
    </div>
  )
}
