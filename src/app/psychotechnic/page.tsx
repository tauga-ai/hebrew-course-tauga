'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PSYCHOTECHNIC_SETS } from '@/lib/psychotechnic'
import type { StudentSession } from '@/lib/types'

type Phase = 'select' | 'input' | 'result'

interface QuestionResult {
  q: number; correct: number; student: number; isCorrect: boolean
}

const ANSWER_LABELS = ['', 'א', 'ב', 'ג', 'ד']
const ANSWER_COLORS = ['', 'bg-blue-100 text-blue-800', 'bg-purple-100 text-purple-800', 'bg-orange-100 text-orange-800', 'bg-green-100 text-green-800']

export default function PsychotechnicPage() {
  const router = useRouter()
  const [session, setSession] = useState<StudentSession | null>(null)
  const [phase, setPhase] = useState<Phase>('select')
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [results, setResults] = useState<{ results: QuestionResult[]; score: number; total: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('student_session')
    if (!raw) { router.replace('/student'); return }
    setSession(JSON.parse(raw))
  }, [router])

  const selectedSet = PSYCHOTECHNIC_SETS.find(s => s.id === selectedSetId)
  const numQuestions = selectedSet?.answers.length || 0

  function selectSet(id: number) {
    setSelectedSetId(id)
    const set = PSYCHOTECHNIC_SETS.find(s => s.id === id)
    setAnswers(new Array(set?.answers.length || 10).fill(0))
    setPhase('input')
    setResults(null)
  }

  function setAnswer(questionIdx: number, answer: number) {
    setAnswers(prev => {
      const next = [...prev]
      next[questionIdx] = answer
      return next
    })
  }

  async function handleSubmit() {
    if (!session || !selectedSetId) return
    const unanswered = answers.filter(a => a === 0).length
    if (unanswered > 0) {
      alert(`יש לענות על כל השאלות. נותרו ${unanswered} ללא תשובה.`)
      return
    }
    setSubmitting(true)
    const res = await fetch('/api/psychotechnic/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: session.id,
        class_id: session.class_id,
        set_id: selectedSetId,
        answers,
      }),
    })
    const data = await res.json()
    setResults(data)
    setPhase('result')
    setSubmitting(false)
  }

  const answeredCount = answers.filter(a => a > 0).length

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mt-4 mb-6">
        <button onClick={() => phase === 'input' ? setPhase('select') : router.push('/menu')}
          className="text-sm text-gray-400 hover:text-gray-600">← חזרה</button>
        <h1 className="font-bold text-blue-700">פסיכוטכני — הזנת תשובות</h1>
        <div className="text-sm text-gray-500">{session?.full_name}</div>
      </div>

      {/* ── SELECT SET ── */}
      {phase === 'select' && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800 text-right">
            <p className="font-semibold mb-1">📋 איך זה עובד?</p>
            <p>ענית על מקבץ פסיכוטכני בדף הכתוב. בחר כאן את שם המקבץ שענית עליו, הכנס את התשובות שסימנת, ותקבל מיד את הציון שלך.</p>
          </div>
          <h2 className="text-base font-semibold text-gray-700 mb-3">בחר מקבץ:</h2>
          <div className="grid gap-2">
            {PSYCHOTECHNIC_SETS.map(set => (
              <button key={set.id} onClick={() => selectSet(set.id)}
                className="w-full text-right bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-400 hover:shadow-sm transition flex justify-between items-center group">
                <div>
                  <div className="font-semibold text-gray-800">{set.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{set.answers.length} שאלות</div>
                </div>
                <span className="text-blue-400 group-hover:translate-x-1 transition-transform">←</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── INPUT ANSWERS ── */}
      {phase === 'input' && selectedSet && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-gray-800">{selectedSet.name}</span>
              <span className="text-sm text-gray-500">{answeredCount}/{numQuestions} הוזנו</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${(answeredCount / numQuestions) * 100}%` }} />
            </div>
          </div>

          <div className="space-y-3 mb-5">
            {Array.from({ length: numQuestions }, (_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm font-semibold text-gray-600 mb-3">שאלה {i + 1}</div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setAnswer(i, opt)}
                      className={`py-3 rounded-xl text-base font-bold transition border-2 ${
                        answers[i] === opt
                          ? 'border-blue-500 bg-blue-500 text-white shadow-md scale-105'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleSubmit} disabled={submitting || answeredCount < numQuestions}
            className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition disabled:opacity-40 text-lg">
            {submitting ? 'שולח...' : `הגש (${answeredCount}/${numQuestions})`}
          </button>
          {answeredCount < numQuestions && (
            <p className="text-center text-orange-500 text-xs mt-2">יש עוד {numQuestions - answeredCount} שאלות ללא תשובה</p>
          )}
        </>
      )}

      {/* ── RESULTS ── */}
      {phase === 'result' && results && selectedSet && (
        <>
          {/* Score */}
          <div className={`rounded-2xl border p-6 text-center mb-4 ${
            results.score / results.total >= 0.7 ? 'bg-green-50 border-green-200' :
            results.score / results.total >= 0.5 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className={`text-6xl font-bold ${
              results.score / results.total >= 0.7 ? 'text-green-600' :
              results.score / results.total >= 0.5 ? 'text-yellow-600' : 'text-red-500'
            }`}>{results.score}/{results.total}</div>
            <div className="text-gray-500 text-sm mt-1">{Math.round((results.score / results.total) * 100)}% נכון</div>
            <div className="text-gray-600 text-sm font-medium mt-1">{selectedSet.name}</div>
          </div>

          {/* Per-question results */}
          <div className="space-y-2 mb-5">
            {results.results.map(r => (
              <div key={r.q} className={`rounded-xl border p-3 flex items-center justify-between ${
                r.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">{r.isCorrect ? '✅' : '❌'}</span>
                  <span className="text-sm font-medium text-gray-700">שאלה {r.q}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">סימנת: <strong>{r.student}</strong></span>
                  {!r.isCorrect && <span className="text-green-700">נכון: <strong>{r.correct}</strong></span>}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setPhase('select'); setResults(null) }}
              className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition">
              מקבץ נוסף
            </button>
            <button onClick={() => router.push('/menu')}
              className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition">
              חזור לתפריט
            </button>
          </div>
        </>
      )}
    </div>
  )
}
