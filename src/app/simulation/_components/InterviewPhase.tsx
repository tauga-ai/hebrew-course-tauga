'use client'

import type { ReactNode } from 'react'
import type { useSpeechToText } from '@/lib/hooks/use-speech-to-text'

interface InterviewIntroPhaseProps {
  questionCount: number
  onStart: () => void
}

/** Part D intro screen — shown before the interview questions start. */
export function InterviewIntroPhase({ questionCount, onStart }: InterviewIntroPhaseProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md max-w-md w-full p-8 text-center">
        <div className="text-5xl mb-4">🎤</div>
        <h2 className="text-xl font-bold text-blue-700 mb-2">חלק ד — ראיון אישי</h2>
        <p className="text-gray-600 mb-6 text-sm">
          תענה על {questionCount} שאלות ראיון. תוכל לכתוב או להקליט את עצמך.
          בסוף תקבל ציון ופידבק.
        </p>
        <button onClick={onStart}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition">
          התחל ראיון
        </button>
      </div>
    </div>
  )
}

interface InterviewPhaseProps {
  stepHeader: ReactNode
  progressBar: ReactNode
  processing: boolean
  questions: string[]
  currentIdx: number
  currentAnswer: string
  setCurrentAnswer: (value: string) => void
  interviewSpeech: ReturnType<typeof useSpeechToText>
  onNextQuestion: () => void
}

/** Part D — one interview question at a time, with a processing screen while feedback is generated. */
export function InterviewPhase({
  stepHeader, progressBar, processing, questions, currentIdx,
  currentAnswer, setCurrentAnswer, interviewSpeech, onNextQuestion,
}: InterviewPhaseProps) {
  if (processing) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-5xl animate-bounce">🤖</div>
      <p className="text-gray-500">מנתח את הראיון ומכין פידבק...</p>
      <div className="flex gap-2">{[0, 1, 2].map(i => <div key={i} className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
    </div>
  )

  const q = questions[currentIdx]
  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      {stepHeader}
      {progressBar}
      <div className="flex justify-between text-sm text-gray-500 mb-4">
        <span>שאלה {currentIdx + 1} / {questions.length}</span>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
        <p className="text-xl font-semibold text-gray-800 leading-relaxed">{q}</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-gray-700">תשובתי</span>
          {interviewSpeech.supported && (
            <button onClick={() => interviewSpeech.isListening ? interviewSpeech.stop() : interviewSpeech.start(currentAnswer)}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium ${interviewSpeech.isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
              {interviewSpeech.isListening ? '⏹ עצור' : '🎤 הקלט את עצמך'}
            </button>
          )}
        </div>
        <textarea value={currentAnswer} onChange={e => setCurrentAnswer(e.target.value)}
          placeholder="כתוב את תשובתך כאן..." rows={5}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800" />
      </div>
      <button onClick={onNextQuestion}
        className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition text-lg">
        {currentIdx + 1 === questions.length ? 'סיים וקבל פידבק' : `שאלה הבאה (${currentIdx + 2}/${questions.length})`}
      </button>
      <button onClick={onNextQuestion} className="w-full mt-2 text-xs text-gray-400 hover:text-gray-500 py-1">דלג</button>
    </div>
  )
}
