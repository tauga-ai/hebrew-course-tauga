'use client'

import type { ReactNode } from 'react'
import type { SentenceFeedback } from '@/app/api/sentence/feedback/route'
import type { useSpeechToText } from '@/lib/hooks/use-speech-to-text'

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
      <div className="text-sm text-gray-500 mb-4">תרגיל {currentEx + 1} / {partC.length}</div>

      {!currentFeedback ? (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-800">
            השתמש בכל המילים <strong>★ המסומנות בכחול</strong> ובלפחות 6 מילים מהרשימה.
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <div className="flex flex-wrap gap-2">
              {words.map((w, i) => (
                <span key={i} className={`px-3 py-1.5 rounded-full text-sm font-medium border ${w.starred ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                  {w.starred ? '★ ' : ''}{w.text}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">המשפט שלי</span>
              <div className="flex gap-2">
                {sentenceInput && <button onClick={() => setSentenceInput('')} className="text-xs text-gray-400 hover:text-red-400 px-2 py-1">נקה</button>}
                {sentenceSpeech.supported && (
                  <button onClick={() => sentenceSpeech.isListening ? sentenceSpeech.stop() : sentenceSpeech.start(sentenceInput)}
                    className={`text-sm px-3 py-1.5 rounded-lg font-medium ${sentenceSpeech.isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                    {sentenceSpeech.isListening ? '⏹ עצור' : '🎤 הקלט את עצמך'}
                  </button>
                )}
              </div>
            </div>
            <textarea value={sentenceInput} onChange={e => setSentenceInput(e.target.value)}
              placeholder="כתוב את המשפט שלך כאן..." rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800" />
          </div>
          <button onClick={onSubmitSentence} disabled={!sentenceInput.trim() || evalLoading}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition">
            {evalLoading ? 'בודק...' : 'שלח לבדיקה'}
          </button>
        </>
      ) : (
        <>
          <div className={`rounded-2xl border p-4 text-center mb-3 ${currentFeedback.score >= 7 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className={`text-4xl font-bold ${currentFeedback.score >= 7 ? 'text-green-600' : 'text-yellow-600'}`}>{currentFeedback.score}/10</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
            <p className="text-xs text-gray-400 mb-1">המשפט שלך</p>
            <p className="text-gray-800 text-sm">{sentenceInput}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
            <p className="text-sm text-gray-700">{currentFeedback.feedback}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
            <p className="text-xs text-green-600 font-semibold mb-1">✨ גרסה מושלמת</p>
            <p className="text-green-800 text-sm font-medium">{currentFeedback.improved_sentence}</p>
          </div>
          <button onClick={onNextSentence} disabled={submitting}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition">
            {submitting ? 'שולח...' : currentEx + 1 >= partC.length ? 'עבור לראיון →' : `תרגיל הבא (${currentEx + 2}/${partC.length}) →`}
          </button>
        </>
      )}
    </div>
  )
}
