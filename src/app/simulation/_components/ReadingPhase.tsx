'use client'

import type { ReactNode } from 'react'

interface SimQuestion {
  id: number; part: number; q_order: number
  passage_text: string; question_text: string
  option_1: string; option_2: string; option_3: string; option_4: string
  correct_answer: number
}

const HEBREW = ['א', 'ב', 'ג', 'ד']

interface ReadingPhaseProps {
  stepHeader: ReactNode
  progressBar: ReactNode
  keyPrefix: 'a' | 'b'
  questions: SimQuestion[]
  currentQ: number
  setCurrentQ: (updater: (i: number) => number) => void
  readingAnswers: Record<number, number>
  setReadingAnswers: (updater: (prev: Record<number, number>) => Record<number, number>) => void
  getShuffledOptions: (q: SimQuestion) => { num: number; text: string }[]
  /** Part B groups consecutive questions under one shared passage; Part A always shows its own passage. */
  groupByPassage: boolean
  /** Preserves an existing asymmetry: only Part A shows this warning on its last question. */
  showUnansweredWarning: boolean
  finishLabel: string
  onFinish: () => void
  /** True while the finish-part submission is in flight — disables the finish button. */
  submitting?: boolean
  /** Shown above the questions when the last submit attempt failed. */
  errorBanner?: ReactNode
}

/** Shared UI for Parts A and B — multiple-choice reading comprehension questions. */
export function ReadingPhase({
  stepHeader, progressBar, keyPrefix, questions, currentQ, setCurrentQ,
  readingAnswers, setReadingAnswers, getShuffledOptions,
  groupByPassage, showUnansweredWarning, finishLabel, onFinish,
  submitting, errorBanner,
}: ReadingPhaseProps) {
  const q = questions[currentQ]
  const opts = q ? getShuffledOptions(q) : []
  const answered = questions.filter(qq => readingAnswers[qq.id] !== undefined).length
  const isNewPassage = !groupByPassage || currentQ === 0 || questions[currentQ]?.passage_text !== questions[currentQ - 1]?.passage_text

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      {stepHeader}
      {progressBar}
      {errorBanner}
      <div className="flex justify-between text-sm text-gray-500 mb-4">
        <span>שאלה {currentQ + 1} / {questions.length}</span>
        <span>{answered} נענו</span>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        {isNewPassage && <p className="text-gray-700 leading-relaxed text-sm mb-3 pb-3 border-b border-gray-100 whitespace-pre-line">{q?.passage_text}</p>}
        {groupByPassage && !isNewPassage && <p className="text-xs text-gray-400 mb-2 italic">(אותו קטע)</p>}
        <p className="text-gray-800 font-semibold leading-relaxed">{q?.question_text}</p>
      </div>
      <div key={`${keyPrefix}-${q?.id}`} className="space-y-3 mb-4">
        {opts.map((opt, i) => {
          const sel = readingAnswers[q?.id] === opt.num
          return (
            <button key={`${q?.id}-${opt.num}`}
              onClick={() => setReadingAnswers(prev => ({ ...prev, [q.id]: opt.num }))}
              className={`w-full text-right rounded-xl border p-3.5 transition flex items-center gap-3 ${sel ? 'bg-primary-50 border-primary-400' : 'bg-white border-gray-200 hover:border-primary-300'}`}>
              <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${sel ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{HEBREW[i]}</span>
              <span className="text-sm">{opt.text}</span>
            </button>
          )
        })}
      </div>
      <div className="flex justify-between">
        <button onClick={() => setCurrentQ(i => Math.max(0, i - 1))} disabled={currentQ === 0}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-30 hover:bg-gray-50">← הקודמת</button>
        {currentQ < questions.length - 1
          ? <button onClick={() => setCurrentQ(i => i + 1)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">הבאה →</button>
          : <button onClick={onFinish} disabled={answered < questions.length || submitting}
              className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-primary-700">{submitting ? 'שולח...' : finishLabel}</button>
        }
      </div>
      {showUnansweredWarning && answered < questions.length && currentQ === questions.length - 1 && (
        <p className="text-orange-500 text-xs text-center mt-2">עדיין חסרות {questions.length - answered} תשובות</p>
      )}
    </div>
  )
}
