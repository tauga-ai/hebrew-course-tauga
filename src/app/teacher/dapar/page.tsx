'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DAPAR_CORRECT_ANSWERS, DAPAR_SECTIONS, DAPAR_TOTAL } from '@/lib/dapar'

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
  const [className, setClassName] = useState('')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [sectionStats, setSectionStats] = useState<SectionStat[]>([])
  const [selectedSection, setSelectedSection] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('sections')

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.replace('/teacher/login'); return }
        const res = await fetch(`/api/teacher/dapar?email=${encodeURIComponent(user.email || '')}`)
        if (!res.ok) { router.replace('/teacher/dashboard'); return }
        const data = await res.json()
        setClassName(data.class_name)
        setSubmissions(data.submissions)
        setQuestionStats(data.question_stats)
        setSectionStats(data.section_stats)
      } catch {
        // auth or network error — go back to dashboard
        router.replace('/teacher/dashboard')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  const scoreColor = (v: number | null) => {
    if (v === null) return 'text-gray-300'
    return v >= 70 ? 'text-green-600' : v >= 50 ? 'text-yellow-600' : 'text-red-500'
  }

  const filteredQuestions = selectedSection !== null
    ? questionStats.filter(q => {
        const s = DAPAR_SECTIONS[selectedSection]
        return q.question >= s.from && q.question <= s.to
      })
    : questionStats

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">טוען...</p></div>

  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mt-4 mb-6">
        <button onClick={() => router.push('/teacher/dashboard')} className="text-sm text-gray-400 hover:text-gray-600">← חזרה</button>
        <div className="text-center">
          <h1 className="font-bold text-blue-700">סימולציית דפ&quot;ר</h1>
          <p className="text-xs text-gray-500">{className} · {submissions.length} הגשות</p>
        </div>
        <div />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['sections', 'students', 'questions'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t === 'sections' ? 'סיכום יחידות' : t === 'students' ? `לפי תלמיד (${submissions.length})` : 'ניתוח שאלות'}
          </button>
        ))}
      </div>

      {/* SECTIONS TAB */}
      {tab === 'sections' && (
        sectionStats.length === 0 ? (
          <p className="text-center text-gray-400 mt-12">אין נתונים עדיין</p>
        ) : (
          <div className="grid gap-3">
            {sectionStats.map((s, idx) => (
              <button key={s.label} onClick={() => { setSelectedSection(idx); setTab('questions') }}
                className="w-full text-right bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-gray-800">{s.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.submissions} הגשות</div>
                  </div>
                  <div className="text-left">
                    <div className={`text-2xl font-bold ${scoreColor(s.avg_pct)}`}>
                      {s.avg_pct !== null ? `${s.avg_pct}%` : '—'}
                    </div>
                    <div className="text-xs text-gray-400">ממוצע</div>
                  </div>
                </div>
                {s.avg_pct !== null && (
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${s.avg_pct >= 70 ? 'bg-green-500' : s.avg_pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
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
          <p className="text-center text-gray-400 mt-12">אין הגשות</p>
        ) : (
          <div className="space-y-3">
            {submissions.map(s => {
              const sectionScores = DAPAR_SECTIONS.map(sec => {
                const correct = s.answers.slice(sec.from - 1, sec.to)
                  .filter((a, j) => a === DAPAR_CORRECT_ANSWERS[sec.from - 1 + j]).length
                return { label: sec.label, correct, pct: Math.round((correct / 10) * 100) }
              })
              return (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-semibold text-gray-800">{s.student_name}</div>
                      <div className="text-xs text-gray-400">{new Date(s.submitted_at).toLocaleDateString('he-IL')}</div>
                    </div>
                    <div className={`text-2xl font-bold ${scoreColor(s.pct)}`}>{s.pct}%
                      <span className="text-xs text-gray-400 block text-center">{s.score}/{DAPAR_TOTAL}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {sectionScores.map(sec => (
                      <div key={sec.label} className={`rounded-lg p-2 text-center text-xs ${sec.pct >= 70 ? 'bg-green-50 text-green-700' : sec.pct >= 50 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'}`}>
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
          <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSelectedSection(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${selectedSection === null ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                כל השאלות
              </button>
              {DAPAR_SECTIONS.map((s, i) => (
                <button key={s.label} onClick={() => setSelectedSection(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${selectedSection === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {filteredQuestions.length === 0 ? (
            <p className="text-center text-gray-400 mt-12">אין נתונים עדיין</p>
          ) : (
            <div className="space-y-3">
              {filteredQuestions.map(q => (
                <div key={q.question} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-semibold text-gray-800">שאלה {q.question}</span>
                      <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full mr-2">תשובה נכונה: {q.correct_answer}</span>
                    </div>
                    <div className={`text-2xl font-bold ${scoreColor(q.success_pct)}`}>
                      {q.success_pct !== null ? `${q.success_pct}%` : '—'}
                      <span className="text-xs text-gray-400 block text-center">{q.correct_count}/{q.total_answers}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {[1, 2, 3, 4].map(opt => {
                      const count = q.distribution[opt] || 0
                      const pct = q.total_answers > 0 ? Math.round((count / q.total_answers) * 100) : 0
                      const isCorrect = opt === q.correct_answer
                      return (
                        <div key={opt} className="flex items-center gap-2">
                          <span className={`text-xs font-bold w-5 text-center ${isCorrect ? 'text-green-700' : 'text-gray-500'}`}>{opt}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                            <div className={`h-4 rounded-full transition-all ${isCorrect ? 'bg-green-500' : count > 0 ? 'bg-red-300' : 'bg-gray-200'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-xs w-16 text-left ${isCorrect ? 'text-green-700 font-semibold' : 'text-gray-500'}`}>
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
    </div>
  )
}
