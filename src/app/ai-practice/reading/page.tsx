'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AIReadingQuestion } from '@/app/api/ai-practice/reading/route'
import type { StudentSession } from '@/lib/types'

const LEVEL_LABELS: Record<number, string> = {
  1: 'משפטים פשוטים — מי, מה, איפה',
  2: 'סיבות וזמנים — למה, מתי',
  3: 'ניגודים ורעיונות — למרות ש, כי',
  4: 'קטעים מידעיים — פסקה שלמה',
  5: 'קטעים מתקדמים — ניתוח ומסקנות',
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'border-green-300 bg-green-50 text-green-700',
  2: 'border-blue-300 bg-blue-50 text-blue-700',
  3: 'border-yellow-300 bg-yellow-50 text-yellow-700',
  4: 'border-orange-300 bg-orange-50 text-orange-700',
  5: 'border-red-300 bg-red-50 text-red-700',
}

const HEBREW = ['א', 'ב', 'ג', 'ד']

type Phase = 'pick' | 'loading' | 'question' | 'result'

export default function AIReadingPage() {
  const router = useRouter()
  const [session, setSession] = useState<StudentSession | null>(null)
  const [level, setLevel] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('pick')
  const [question, setQuestion] = useState<AIReadingQuestion | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [stats, setStats] = useState({ correct: 0, total: 0 })
  const [error, setError] = useState('')

  useEffect(() => {
    const raw = localStorage.getItem('student_session')
    if (!raw) { router.replace('/student'); return }
    setSession(JSON.parse(raw))
  }, [router])

  async function generateQuestion(lvl: number) {
    setLevel(lvl)
    setPhase('loading')
    setSelected(null)
    setError('')
    try {
      const res = await fetch('/api/ai-practice/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: lvl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setQuestion(data.question)
      setPhase('question')
    } catch {
      setError('שגיאה ביצירת השאלה. נסה שוב.')
      setPhase('pick')
    }
  }

  function submitAnswer() {
    if (selected === null || !question) return
    const isCorrect = selected === question.correct_index
    setStats(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }))
    setPhase('result')
  }

  const isCorrect = selected !== null && question !== null && selected === question.correct_index

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mt-4 mb-6">
        <button onClick={() => router.push('/menu')} className="text-sm text-gray-400 hover:text-gray-600">← תפריט</button>
        <div className="text-center">
          <h1 className="font-bold text-blue-700">הבנת הנקרא עם AI</h1>
          {level && <div className="text-xs text-gray-500">רמה {level}</div>}
        </div>
        {stats.total > 0 ? (
          <div className="text-sm text-gray-500">{stats.correct}/{stats.total} ✓</div>
        ) : <div />}
      </div>

      {/* ── PICK LEVEL ── */}
      {phase === 'pick' && (
        <>
          <p className="text-center text-gray-500 text-sm mb-6">בחר רמה וה-AI יצור לך שאלה בהבנת הנקרא</p>
          <div className="grid gap-3">
            {[1, 2, 3, 4, 5].map(lvl => (
              <button
                key={lvl}
                onClick={() => generateQuestion(lvl)}
                className={`w-full text-right rounded-2xl border-2 p-4 transition hover:shadow-md ${LEVEL_COLORS[lvl]}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold">רמה {lvl}</div>
                    <div className="text-xs mt-0.5 opacity-80">{LEVEL_LABELS[lvl]}</div>
                  </div>
                  <span className="text-lg">←</span>
                </div>
              </button>
            ))}
          </div>
          {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
          {stats.total > 0 && (
            <div className="mt-6 bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-600">
              סיכום: {stats.correct} נכון מתוך {stats.total} ({Math.round((stats.correct / stats.total) * 100)}%)
            </div>
          )}
        </>
      )}

      {/* ── LOADING ── */}
      {phase === 'loading' && (
        <div className="flex flex-col items-center justify-center min-h-64 gap-4">
          <div className="text-4xl animate-spin">🤖</div>
          <p className="text-gray-500">יוצר שאלה ברמה {level}...</p>
        </div>
      )}

      {/* ── QUESTION ── */}
      {phase === 'question' && question && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${LEVEL_COLORS[level!]}`}>
                רמה {level}
              </span>
              <span className="text-xs text-gray-400">קרא את הטקסט וענה על השאלה</span>
            </div>
            <p className="text-gray-800 leading-relaxed text-base mb-5 whitespace-pre-line border-b border-gray-100 pb-4">
              {question.passage}
            </p>
            <p className="text-gray-700 font-semibold leading-relaxed">{question.question}</p>
          </div>

          <div className="space-y-3 mb-6">
            {question.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`w-full text-right rounded-xl border p-4 transition flex items-center gap-3 ${
                  selected === i
                    ? 'bg-blue-50 border-blue-400 text-blue-800'
                    : 'bg-white border-gray-200 hover:border-blue-300 text-gray-800'
                }`}
              >
                <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  selected === i ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {HEBREW[i]}
                </span>
                <span>{opt}</span>
              </button>
            ))}
          </div>

          <button
            onClick={submitAnswer}
            disabled={selected === null}
            className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition disabled:opacity-40 text-lg"
          >
            בדוק תשובה
          </button>
        </>
      )}

      {/* ── RESULT ── */}
      {phase === 'result' && question && selected !== null && (
        <>
          {/* Result banner */}
          <div className={`rounded-2xl border p-5 text-center mb-4 ${isCorrect ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
            <div className="text-4xl mb-2">{isCorrect ? '✅' : '❌'}</div>
            <div className={`text-xl font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
              {isCorrect ? 'נכון!' : 'לא נכון'}
            </div>
            {!isCorrect && (
              <div className="text-sm text-red-600 mt-1">
                התשובה הנכונה: <strong>{HEBREW[question.correct_index]}. {question.options[question.correct_index]}</strong>
              </div>
            )}
          </div>

          {/* Passage + highlighted answer */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-3">
            <p className="text-xs text-gray-400 mb-2">הטקסט</p>
            <p className="text-gray-800 leading-relaxed text-sm mb-3">{question.passage}</p>
            <p className="text-xs text-gray-400 mb-1">השאלה: {question.question}</p>
          </div>

          {/* Options with result */}
          <div className="space-y-2 mb-4">
            {question.options.map((opt, i) => {
              const isRight = i === question.correct_index
              const isChosen = i === selected
              return (
                <div key={i} className={`rounded-xl border p-3 flex items-center gap-3 ${
                  isRight ? 'bg-green-50 border-green-300' :
                  isChosen && !isRight ? 'bg-red-50 border-red-300' :
                  'bg-gray-50 border-gray-100'
                }`}>
                  <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isRight ? 'bg-green-500 text-white' :
                    isChosen ? 'bg-red-400 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}>{HEBREW[i]}</span>
                  <span className={`text-sm ${isRight ? 'text-green-800 font-semibold' : isChosen ? 'text-red-700' : 'text-gray-500'}`}>
                    {opt}
                  </span>
                  {isRight && <span className="mr-auto text-green-600 text-xs font-bold">✓ נכון</span>}
                </div>
              )
            })}
          </div>

          {/* Explanation */}
          {question.explanation && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 text-sm text-blue-800">
              <strong>הסבר: </strong>{question.explanation}
            </div>
          )}

          <button
            onClick={() => { setPhase('pick'); setQuestion(null); setSelected(null) }}
            className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition text-lg"
          >
            צור תרגיל נוסף
          </button>
          <button
            onClick={() => generateQuestion(level!)}
            className="w-full mt-2 text-sm text-blue-500 hover:text-blue-700 py-2"
          >
            תרגיל נוסף באותה רמה ({level})
          </button>
        </>
      )}
    </div>
  )
}
