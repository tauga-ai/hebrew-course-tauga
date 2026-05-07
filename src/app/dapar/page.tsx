'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentSession } from '@/lib/types'
import { DAPAR_CORRECT_ANSWERS, DAPAR_SECTIONS as SECTIONS, DAPAR_TOTAL as TOTAL } from '@/lib/dapar'

export default function DaparPage() {
  const router = useRouter()
  const [session, setSession] = useState<StudentSession | null>(null)
  const sessionIdRef = useRef<string>('')
  const [answers, setAnswers] = useState<number[]>(new Array(TOTAL).fill(0))
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<number[] | null>(null)
  const [submitError, setSubmitError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const raw = localStorage.getItem('student_session')
      if (!raw) { router.replace('/student'); return }
      const s = JSON.parse(raw)
      setSession(s)
      sessionIdRef.current = s.id

      // 1. Check localStorage for saved results first (fastest)
      const savedResults = localStorage.getItem(`dapar_results_${s.id}`)
      if (savedResults) {
        setResults(JSON.parse(savedResults))
        setLoading(false)
        return
      }

      // 2. Check DB for an existing submission
      try {
        const res = await fetch(`/api/dapar/my-submission?student_id=${s.id}`)
        const data = await res.json()
        if (data.submission?.answers) {
          const dbAnswers = data.submission.answers as number[]
          localStorage.setItem(`dapar_results_${s.id}`, JSON.stringify(dbAnswers))
          setResults(dbAnswers)
          setLoading(false)
          return
        }
      } catch { /* no DB submission — continue to input form */ }

      // 3. Load in-progress answers if no submission found
      const savedAnswers = localStorage.getItem(`dapar_answers_${s.id}`)
      if (savedAnswers) setAnswers(JSON.parse(savedAnswers))
      setLoading(false)
    }
    init()
  }, [router])

  function setAnswer(idx: number, val: number) {
    setAnswers(prev => {
      const next = [...prev]
      next[idx] = val
      if (sessionIdRef.current) {
        localStorage.setItem(`dapar_answers_${sessionIdRef.current}`, JSON.stringify(next))
      }
      return next
    })
  }

  const answered = answers.filter(a => a > 0).length

  async function handleSubmit() {
    if (!session) return
    const unanswered = answers.filter(a => a === 0).length
    if (unanswered > 0 && !confirm(`נותרו ${unanswered} שאלות ללא תשובה. האם להגיש בכל זאת?`)) return
    setSubmitting(true)
    setSubmitError(false)
    try {
      const res = await fetch('/api/dapar/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: session.id, class_id: session.class_id, answers }),
      })
      if (!res.ok) throw new Error('submit failed')
      localStorage.setItem(`dapar_results_${session.id}`, JSON.stringify(answers))
      localStorage.removeItem(`dapar_answers_${session.id}`)
      setResults(answers)
    } catch {
      setSubmitError(true)
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">טוען...</p>
    </div>
  )

  // ── RESULTS SCREEN ──────────────────────────────────────────────────────────
  if (results) {
    const totalCorrect = results.filter((a, i) => a === DAPAR_CORRECT_ANSWERS[i]).length
    const pct = Math.round((totalCorrect / TOTAL) * 100)
    const scoreColor = pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500'

    return (
      <div className="min-h-screen p-4 max-w-3xl mx-auto pb-12">
        <div className="text-center mt-6 mb-6">
          <div className="text-5xl mb-2">🏆</div>
          <h1 className="text-2xl font-bold text-blue-700">תוצאות הסימולציה</h1>
          <p className="text-gray-500 text-sm">{session?.full_name}</p>
          <div className={`text-5xl font-bold mt-3 ${scoreColor}`}>{pct}%</div>
          <p className="text-gray-500 text-sm mt-1">{totalCorrect} נכון מתוך {TOTAL}</p>
        </div>

        {/* Per-section summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {SECTIONS.map(section => {
            const sectionAnswers = results.slice(section.from - 1, section.to)
            const correct = sectionAnswers.filter((a, j) => a === DAPAR_CORRECT_ANSWERS[section.from - 1 + j]).length
            const sPct = Math.round((correct / 10) * 100)
            const color = sPct >= 70 ? 'bg-green-50 border-green-200' : sPct >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
            const textColor = sPct >= 70 ? 'text-green-700' : sPct >= 50 ? 'text-yellow-700' : 'text-red-600'
            return (
              <div key={section.label} className={`rounded-xl border p-3 text-center ${color}`}>
                <div className={`text-2xl font-bold ${textColor}`}>{sPct}%</div>
                <div className="text-xs text-gray-600 mt-0.5">{section.label}</div>
                <div className="text-xs text-gray-400">{correct}/10</div>
              </div>
            )
          })}
        </div>

        {/* Per-question breakdown by section */}
        <div className="space-y-5 mb-6">
          {SECTIONS.map(section => (
            <div key={section.label}>
              <h3 className="text-sm font-bold text-blue-700 mb-2 px-1">{section.label}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array.from({ length: 10 }, (_, j) => {
                  const i = section.from - 1 + j
                  const selected = results[i]
                  const correct = DAPAR_CORRECT_ANSWERS[i]
                  const isCorrect = selected === correct
                  const unanswered = selected === 0
                  return (
                    <div key={i} className={`flex items-center gap-3 rounded-xl border p-3 ${
                      unanswered ? 'bg-gray-50 border-gray-200' :
                      isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <span className="text-sm font-bold text-gray-500 w-6 text-center flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 text-sm">
                        {unanswered ? (
                          <span className="text-gray-400">לא נענתה</span>
                        ) : isCorrect ? (
                          <span className="text-green-700 font-semibold">✓ תשובה {selected}</span>
                        ) : (
                          <span className="text-red-600">
                            ✗ ענית <strong>{selected}</strong> · נכון: <strong>{correct}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Note: results stay in localStorage so student can return and see them */}
        <button onClick={() => router.push('/menu')}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition">
          חזור לתפריט
        </button>
      </div>
    )
  }

  // ── INPUT SCREEN ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mt-4 mb-5">
        <button onClick={() => router.push('/menu')} className="text-sm text-gray-400 hover:text-gray-600">← חזרה</button>
        <div className="text-center">
          <h1 className="font-bold text-blue-700">סימולציית דפ&quot;ר</h1>
          <p className="text-xs text-gray-500">{session?.full_name}</p>
        </div>
        <div className="text-sm font-medium text-gray-600">{answered}/{TOTAL}</div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-5">
        <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${(answered / TOTAL) * 100}%` }} />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 text-sm text-blue-800 text-right">
        לכל שאלה — לחץ על המספר שסימנת בטופס שלך (1 / 2 / 3 / 4)
      </div>

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 text-right">
          אירעה שגיאה בשמירה. בדוק חיבור לאינטרנט ונסה שוב.
        </div>
      )}

      <div className="space-y-6 mb-6">
        {SECTIONS.map(section => {
          const sectionAnswered = answers.slice(section.from - 1, section.to).filter(a => a > 0).length
          return (
            <div key={section.label}>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-sm font-bold text-blue-700">{section.label}</span>
                <span className="text-xs text-gray-400">{sectionAnswered}/10</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array.from({ length: section.to - section.from + 1 }, (_, j) => {
                  const i = section.from - 1 + j
                  return (
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
                  )
                })}
              </div>
            </div>
          )
        })}
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
