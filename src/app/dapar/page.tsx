'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentSession } from '@/lib/types'

const TOTAL = 50

export default function DaparPage() {
  const router = useRouter()
  const [session, setSession] = useState<StudentSession | null>(null)
  const [answers, setAnswers] = useState<number[]>(new Array(TOTAL).fill(0))
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('student_session')
    if (!raw) { router.replace('/student'); return }
    setSession(JSON.parse(raw))
  }, [router])

  function setAnswer(idx: number, val: number) {
    setAnswers(prev => {
      const next = [...prev]
      next[idx] = val
      return next
    })
  }

  const answered = answers.filter(a => a > 0).length

  async function handleSubmit() {
    if (!session) return
    const unanswered = answers.filter(a => a === 0).length
    if (unanswered > 0 && !confirm(`נותרו ${unanswered} שאלות ללא תשובה. האם להגיש בכל זאת?`)) return
    setSubmitting(true)
    await fetch('/api/dapar/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: session.id, class_id: session.class_id, answers }),
    })
    setSubmitted(true)
    setSubmitting(false)
  }

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md max-w-sm w-full p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-green-700 mb-2">הוגש בהצלחה!</h2>
        <p className="text-gray-500 text-sm mb-6">{answered} תשובות נשמרו</p>
        <button onClick={() => router.push('/menu')}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition">
          חזור לתפריט
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mt-4 mb-5">
        <button onClick={() => router.push('/menu')} className="text-sm text-gray-400 hover:text-gray-600">← חזרה</button>
        <div className="text-center">
          <h1 className="font-bold text-blue-700">סימולציית דפ"ר</h1>
          <p className="text-xs text-gray-500">{session?.full_name}</p>
        </div>
        <div className="text-sm font-medium text-gray-600">{answered}/{TOTAL}</div>
      </div>

      {/* Progress */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-5">
        <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${(answered / TOTAL) * 100}%` }} />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 text-sm text-blue-800 text-right">
        לכל שאלה — לחץ על המספר שסימנת בטופס שלך (1 / 2 / 3 / 4)
      </div>

      {/* Answer grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
        {Array.from({ length: TOTAL }, (_, i) => (
          <div key={i} className={`flex items-center gap-3 bg-white rounded-xl border p-3 ${answers[i] > 0 ? 'border-blue-300' : 'border-gray-200'}`}>
            <span className="text-sm font-bold text-gray-500 w-6 text-center flex-shrink-0">{i + 1}</span>
            <div className="grid grid-cols-4 gap-1.5 flex-1">
              {[1, 2, 3, 4].map(opt => (
                <button
                  key={opt}
                  onClick={() => setAnswer(i, opt)}
                  className={`py-2 rounded-lg text-sm font-bold transition border ${
                    answers[i] === opt
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {answers[i] > 0 && (
              <button onClick={() => setAnswer(i, 0)} className="text-xs text-gray-300 hover:text-red-400 flex-shrink-0">✕</button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || answered === 0}
        className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition disabled:opacity-40 text-lg sticky bottom-4"
      >
        {submitting ? 'שולח...' : `הגש (${answered}/${TOTAL} הוזנו)`}
      </button>
    </div>
  )
}
