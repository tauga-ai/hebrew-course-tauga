'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DAPAR_SECTIONS as SECTIONS, DAPAR_TOTAL as TOTAL, gradeDaparAnswers } from '@/lib/dapar'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'

export default function DaparPage() {
  const router = useRouter()
  const { session } = useStudentSession()
  const [answers, setAnswers] = useState<number[]>(new Array(TOTAL).fill(0))
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<number[] | null>(null)
  const [submitError, setSubmitError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    async function init(s: NonNullable<typeof session>) {
      // 1. Check localStorage for saved results first (fastest)
      const savedResults = localStorage.getItem(`dapar_results_${s.id}`)
      if (savedResults) {
        setResults(JSON.parse(savedResults))
        setLoading(false)
        return
      }

      // 2. Check DB for an existing submission
      try {
        const res = await fetch('/api/dapar/my-submission')
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
    init(session)
  }, [session])

  function setAnswer(idx: number, val: number) {
    setAnswers(prev => {
      const next = [...prev]
      next[idx] = val
      if (session) {
        localStorage.setItem(`dapar_answers_${session.id}`, JSON.stringify(next))
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
        body: JSON.stringify({ answers }),
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

  if (loading) return <LoadingSpinner />

  // ── RESULTS SCREEN ──────────────────────────────────────────────────────────
  if (results) {
    const grade = gradeDaparAnswers(results)
    const scoreColor = grade.pct >= 70 ? 'text-green-600 dark:text-green-400' : grade.pct >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'

    return (
      <div className="min-h-screen p-4 max-w-3xl mx-auto pb-12">
        <div className="text-center mt-6 mb-6">
          <div className="text-5xl mb-2">🏆</div>
          <h1 className="text-2xl font-bold text-primary-700">תוצאות הסימולציה</h1>
          <p className="text-fg/60 text-sm">{session?.full_name}</p>
          <div className={`text-5xl font-bold mt-3 ${scoreColor}`}>{grade.pct}%</div>
          <p className="text-fg/60 text-sm mt-1">{grade.totalCorrect} נכון מתוך {TOTAL}</p>
        </div>

        {/* Per-section summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {grade.perSection.map(section => {
            const color = section.pct >= 70 ? 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800' : section.pct >= 50 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-800' : 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800'
            const textColor = section.pct >= 70 ? 'text-green-700 dark:text-green-400' : section.pct >= 50 ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
            return (
              <div key={section.label} className={`rounded-xl border p-3 text-center ${color}`}>
                <div className={`text-2xl font-bold ${textColor}`}>{section.pct}%</div>
                <div className="text-xs text-fg/70 mt-0.5">{section.label}</div>
                <div className="text-xs text-fg/40">{section.correct}/10</div>
              </div>
            )
          })}
        </div>

        {/* Per-question breakdown by section */}
        <div className="space-y-5 mb-6">
          {SECTIONS.map(section => (
            <div key={section.label}>
              <h3 className="text-sm font-bold text-primary-700 mb-2 px-1">{section.label}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {grade.perQuestion.slice(section.from - 1, section.to).map(q => {
                  const unanswered = q.selected === 0
                  return (
                    <div key={q.q} className={`flex items-center gap-3 rounded-xl border p-3 ${
                      unanswered ? 'bg-black/5 dark:bg-white/5 border-card-border' :
                      q.isCorrect ? 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800'
                    }`}>
                      <span className="text-sm font-bold text-fg/60 w-6 text-center flex-shrink-0">{q.q}</span>
                      <div className="flex-1 text-sm">
                        {unanswered ? (
                          <span className="text-fg/40">לא נענתה</span>
                        ) : q.isCorrect ? (
                          <span className="text-green-700 dark:text-green-400 font-semibold">✓ תשובה {q.selected}</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">
                            ✗ ענית <strong>{q.selected}</strong> · נכון: <strong>{q.correct}</strong>
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
          className="w-full bg-primary-600 text-white font-semibold py-3 rounded-xl hover:bg-primary-700 transition">
          חזור לתפריט
        </button>
      </div>
    )
  }

  // ── INPUT SCREEN ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto">
      <PageHeader backHref="/menu" title={'סימולציית דפ"ר'} subtitle={session?.full_name} right={`${answered}/${TOTAL}`} />

      <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-1.5 mb-5">
        <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${(answered / TOTAL) * 100}%` }} />
      </div>

      <div className="bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-800 rounded-xl p-3 mb-5 text-sm text-primary-800 dark:text-primary-300 text-right">
        לכל שאלה: לחץ על המספר שסימנת בטופס שלך (1 / 2 / 3 / 4)
      </div>

      {submitError && (
        <div className="bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-800 rounded-xl p-3 mb-4 text-sm text-red-700 dark:text-red-400 text-right">
          אירעה שגיאה בשמירה. בדוק חיבור לאינטרנט ונסה שוב.
        </div>
      )}

      <div className="space-y-6 mb-6">
        {SECTIONS.map(section => {
          const sectionAnswered = answers.slice(section.from - 1, section.to).filter(a => a > 0).length
          return (
            <div key={section.label}>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-sm font-bold text-primary-700 dark:text-primary-400">{section.label}</span>
                <span className="text-xs text-fg/40">{sectionAnswered}/10</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array.from({ length: section.to - section.from + 1 }, (_, j) => {
                  const i = section.from - 1 + j
                  return (
                    <div key={i} className={`flex items-center gap-3 bg-surface rounded-xl border p-3 ${answers[i] > 0 ? 'border-primary-300 dark:border-primary-700' : 'border-card-border'}`}>
                      <span className="text-sm font-bold text-fg/60 w-6 text-center flex-shrink-0">{i + 1}</span>
                      <div className="grid grid-cols-4 gap-1.5 flex-1">
                        {[1, 2, 3, 4].map(opt => (
                          <button
                            key={opt}
                            onClick={() => setAnswer(i, opt)}
                            className={`py-2 rounded-lg text-sm font-bold transition border ${
                              answers[i] === opt
                                ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                                : 'bg-black/5 dark:bg-white/5 text-fg/70 border-card-border hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      {answers[i] > 0 && (
                        <button onClick={() => setAnswer(i, 0)} aria-label="נקה תשובה" className="text-xs text-fg/30 hover:text-red-400 flex-shrink-0">✕</button>
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
        className="w-full bg-primary-600 text-white font-semibold py-3.5 rounded-xl hover:bg-primary-700 transition disabled:opacity-40 text-lg sticky bottom-4"
      >
        {submitting ? 'שולח...' : `הגש (${answered}/${TOTAL} הוזנו)`}
      </button>
    </div>
  )
}
