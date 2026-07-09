'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DAPAR_SECTIONS, DAPAR_TOTAL, gradeDaparAnswers } from '@/lib/dapar'
import { useTeacherAuth } from '@/lib/hooks/use-teacher-auth'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { scoreColor } from '@/lib/score-color'

interface Submission {
  id: string; student_name: string; student_id: string
  answers: number[]; score: number; total: number; pct: number; submitted_at: string
}
interface QuestionStat {
  question: number; correct_answer: number; total_answers: number
  correct_count: number; success_pct: number | null
  distribution: Record<number, number>
}
interface SectionStat {
  label: string; avg_pct: number | null; total_correct: number; submissions: number
}

type Tab = 'sections' | 'students' | 'questions'

export default function TeacherDaparPage() {
  const router = useRouter()
  const { email } = useTeacherAuth()
  const [className, setClassName] = useState('')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [sectionStats, setSectionStats] = useState<SectionStat[]>([])
  const [selectedSection, setSelectedSection] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('sections')

  useEffect(() => {
    if (!email) return
    async function init() {
      try {
        const res = await fetch('/api/teacher/dapar')
        if (!res.ok) { router.replace('/teacher/dashboard'); return }
        const data = await res.json()
        setClassName(data.class_name)
        setSubmissions(data.submissions)
        setQuestionStats(data.question_stats)
        setSectionStats(data.section_stats)
      } catch {
        // network error — go back to dashboard
        router.replace('/teacher/dashboard')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [email, router])

  const barColor = (v: number | null) => scoreColor(v, { palette: { good: 'bg-green-500', ok: 'bg-yellow-400', bad: 'bg-red-400' } })
  const sectionColor = (v: number) => scoreColor(v, {
    palette: {
      good: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400',
      ok: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
      bad: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
    },
  })

  const filteredQuestions = selectedSection !== null
    ? questionStats.filter(q => {
        const s = DAPAR_SECTIONS[selectedSection]
        return q.question >= s.from && q.question <= s.to
      })
    : questionStats

  if (loading) return <LoadingSpinner />

  return (
    <>
      <div className="mb-6">
        <h1 className="font-bold text-primary-700 dark:text-primary-400">סימולציית דפ&quot;ר</h1>
        <p className="text-xs text-fg/60">{className} · {submissions.length} הגשות</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['sections', 'students', 'questions'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-primary-600 text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'}`}>
            {t === 'sections' ? 'סיכום יחידות' : t === 'students' ? `לפי תלמיד (${submissions.length})` : 'ניתוח שאלות'}
          </button>
        ))}
      </div>

      {/* SECTIONS TAB */}
      {tab === 'sections' && (
        sectionStats.length === 0 ? (
          <p className="text-center text-fg/40 mt-12">אין נתונים עדיין</p>
        ) : (
          <div className="grid gap-3">
            {sectionStats.map((s, idx) => (
              <button key={s.label} onClick={() => { setSelectedSection(idx); setTab('questions') }}
                className="w-full text-right bg-surface rounded-xl border border-card-border p-4 hover:border-primary-300 hover:shadow-sm transition">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-fg">{s.label}</div>
                    <div className="text-xs text-fg/60 mt-0.5">{s.submissions} הגשות</div>
                  </div>
                  <div className="text-left">
                    <div className={`text-2xl font-bold ${scoreColor(s.avg_pct)}`}>
                      {s.avg_pct !== null ? `${s.avg_pct}%` : '—'}
                    </div>
                    <div className="text-xs text-fg/40">ממוצע</div>
                  </div>
                </div>
                {s.avg_pct !== null && (
                  <div className="mt-2 w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${barColor(s.avg_pct)}`}
                      style={{ width: `${s.avg_pct}%` }} />
                  </div>
                )}
              </button>
            ))}
          </div>
        )
      )}

      {/* STUDENTS TAB */}
      {tab === 'students' && (
        submissions.length === 0 ? (
          <p className="text-center text-fg/40 mt-12">אין הגשות</p>
        ) : (
          <div className="space-y-3">
            {submissions.map(s => {
              const sectionScores = gradeDaparAnswers(s.answers).perSection
              return (
                <div key={s.id} className="bg-surface rounded-xl border border-card-border p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-semibold text-fg">{s.student_name}</div>
                      <div className="text-xs text-fg/40">{new Date(s.submitted_at).toLocaleDateString('he-IL')}</div>
                    </div>
                    <div className={`text-2xl font-bold ${scoreColor(s.pct)}`}>{s.pct}%
                      <span className="text-xs text-fg/40 block text-center">{s.score}/{DAPAR_TOTAL}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {sectionScores.map(sec => (
                      <div key={sec.label} className={`rounded-lg p-2 text-center text-xs ${sectionColor(sec.pct)}`}>
                        <div className="font-bold text-base">{sec.pct}%</div>
                        <div className="leading-tight mt-0.5">{sec.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* QUESTIONS TAB */}
      {tab === 'questions' && (
        <>
          {/* Section filter */}
          <div className="bg-surface rounded-xl border border-card-border p-3 mb-4">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSelectedSection(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${selectedSection === null ? 'bg-primary-600 text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'}`}>
                כל השאלות
              </button>
              {DAPAR_SECTIONS.map((s, i) => (
                <button key={s.label} onClick={() => setSelectedSection(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${selectedSection === i ? 'bg-primary-600 text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {filteredQuestions.length === 0 ? (
            <p className="text-center text-fg/40 mt-12">אין נתונים עדיין</p>
          ) : (
            <div className="space-y-3">
              {filteredQuestions.map(q => (
                <div key={q.question} className="bg-surface rounded-xl border border-card-border p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-semibold text-fg">שאלה {q.question}</span>
                      <span className="text-xs text-green-700 bg-green-100 dark:bg-green-500/10 dark:text-green-400 px-2 py-0.5 rounded-full mr-2">תשובה נכונה: {q.correct_answer}</span>
                    </div>
                    <div className={`text-2xl font-bold ${scoreColor(q.success_pct)}`}>
                      {q.success_pct !== null ? `${q.success_pct}%` : '—'}
                      <span className="text-xs text-fg/40 block text-center">{q.correct_count}/{q.total_answers}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {[1, 2, 3, 4].map(opt => {
                      const count = q.distribution[opt] || 0
                      const pct = q.total_answers > 0 ? Math.round((count / q.total_answers) * 100) : 0
                      const isCorrect = opt === q.correct_answer
                      return (
                        <div key={opt} className="flex items-center gap-2">
                          <span className={`text-xs font-bold w-5 text-center ${isCorrect ? 'text-green-700 dark:text-green-400' : 'text-fg/60'}`}>{opt}</span>
                          <div className="flex-1 bg-gray-100 dark:bg-white/10 rounded-full h-4 overflow-hidden">
                            <div className={`h-4 rounded-full transition-all ${isCorrect ? 'bg-green-500' : count > 0 ? 'bg-red-300' : 'bg-gray-200 dark:bg-white/10'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-xs w-16 text-left ${isCorrect ? 'text-green-700 dark:text-green-400 font-semibold' : 'text-fg/60'}`}>
                            {count} ({pct}%) {isCorrect ? '✓' : ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
