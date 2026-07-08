'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTeacherAuth } from '@/lib/hooks/use-teacher-auth'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface SessionRow {
  session_id: string; student_name: string; status: string
  part_a_correct: number; part_a_total: number; part_a_pct: number | null
  part_b_correct: number; part_b_total: number; part_b_pct: number | null
  part_c_avg: string | null; part_d_score: number | null; part_d_level: string | null
  started_at: string
}
interface QuestionStat {
  question_id: number; part: number; q_order: number
  question_text: string; attempts: number; correct: number; success_pct: number | null
}

export default function SimulationReportPage() {
  const router = useRouter()
  const { email } = useTeacherAuth()
  const [className, setClassName] = useState('')
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'students' | 'questions'>('students')

  useEffect(() => {
    if (!email) return
    async function load() {
      const res = await fetch(`/api/teacher/simulation-report?email=${encodeURIComponent(email)}`)
      if (!res.ok) { router.replace('/teacher/dashboard'); return }
      const data = await res.json()
      setClassName(data.class_name)
      setSessions(data.sessions)
      setQuestionStats(data.question_stats)
      setLoading(false)
    }
    load()
  }, [email, router])

  if (loading) return <LoadingSpinner />

  const completed = sessions.filter(s => s.status === 'completed')
  const classAvgA = completed.length > 0 && completed.filter(s => s.part_a_pct !== null).length > 0
    ? Math.round(completed.filter(s => s.part_a_pct !== null).reduce((acc, s) => acc + (s.part_a_pct || 0), 0) / completed.filter(s => s.part_a_pct !== null).length)
    : null
  const classAvgB = completed.length > 0 && completed.filter(s => s.part_b_pct !== null).length > 0
    ? Math.round(completed.filter(s => s.part_b_pct !== null).reduce((acc, s) => acc + (s.part_b_pct || 0), 0) / completed.filter(s => s.part_b_pct !== null).length)
    : null

  const scoreColor = (v: number | null) => {
    if (v === null) return 'text-fg/30'
    return v >= 70 ? 'text-green-600 dark:text-green-400' : v >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-bold text-primary-700 dark:text-primary-400">דוח סימולציה</h1>
        <p className="text-xs text-fg/60">{className}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-surface rounded-xl border border-card-border p-3 text-center">
          <div className="text-2xl font-bold text-fg">{sessions.length}</div>
          <div className="text-xs text-fg/60">ניסיונות</div>
        </div>
        <div className="bg-surface rounded-xl border border-card-border p-3 text-center">
          <div className="text-2xl font-bold text-fg">{completed.length}</div>
          <div className="text-xs text-fg/60">הושלמו</div>
        </div>
        <div className={`bg-surface rounded-xl border border-card-border p-3 text-center`}>
          <div className={`text-2xl font-bold ${scoreColor(classAvgA)}`}>{classAvgA !== null ? `${classAvgA}%` : '—'}</div>
          <div className="text-xs text-fg/60">ממוצע חלק א</div>
        </div>
        <div className={`bg-surface rounded-xl border border-card-border p-3 text-center`}>
          <div className={`text-2xl font-bold ${scoreColor(classAvgB)}`}>{classAvgB !== null ? `${classAvgB}%` : '—'}</div>
          <div className="text-xs text-fg/60">ממוצע חלק ב</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('students')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'students' ? 'bg-primary-600 text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'}`}>
          תלמידים ({sessions.length})
        </button>
        <button onClick={() => setActiveTab('questions')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'questions' ? 'bg-primary-600 text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'}`}>
          ניתוח שאלות ({questionStats.length})
        </button>
      </div>

      {/* Students tab */}
      {activeTab === 'students' && (
        sessions.length === 0 ? (
          <p className="text-center text-fg/40 mt-12">אין נתוני סימולציה עדיין</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-surface rounded-xl border border-card-border text-sm">
              <thead>
                <tr className="bg-black/5 dark:bg-white/5 border-b border-card-border">
                  <th className="text-right p-3 font-semibold text-fg/80">תלמיד</th>
                  <th className="p-3 text-center font-semibold text-fg/80">סטטוס</th>
                  <th className="p-3 text-center font-semibold text-fg/80">חלק א (16)</th>
                  <th className="p-3 text-center font-semibold text-fg/80">חלק ב (24)</th>
                  <th className="p-3 text-center font-semibold text-fg/80">משפטים</th>
                  <th className="p-3 text-center font-semibold text-fg/80">ראיון</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={s.session_id} className={i % 2 === 0 ? 'bg-surface' : 'bg-black/5 dark:bg-white/5'}>
                    <td className="p-3 font-medium text-fg">{s.student_name}</td>
                    <td className="p-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400'}`}>
                        {s.status === 'completed' ? 'הושלם' : 'בתהליך'}
                      </span>
                    </td>
                    <td className={`p-3 text-center font-semibold ${scoreColor(s.part_a_pct)}`}>
                      {s.part_a_pct !== null ? `${s.part_a_pct}%` : '—'}
                      {s.part_a_correct != null && <span className="text-xs text-fg/40 mr-1">({s.part_a_correct}/{s.part_a_total})</span>}
                    </td>
                    <td className={`p-3 text-center font-semibold ${scoreColor(s.part_b_pct)}`}>
                      {s.part_b_pct !== null ? `${s.part_b_pct}%` : '—'}
                      {s.part_b_correct != null && <span className="text-xs text-fg/40 mr-1">({s.part_b_correct}/{s.part_b_total})</span>}
                    </td>
                    <td className={`p-3 text-center font-semibold ${s.part_c_avg ? (parseFloat(s.part_c_avg) >= 7 ? 'text-green-600 dark:text-green-400' : parseFloat(s.part_c_avg) >= 5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400') : 'text-fg/30'}`}>
                      {s.part_c_avg ? `${s.part_c_avg}/10` : '—'}
                    </td>
                    <td className={`p-3 text-center font-semibold ${scoreColor(s.part_d_score)}`}>
                      {s.part_d_score !== null ? `${s.part_d_score}/100` : '—'}
                      {s.part_d_level && <span className="text-xs text-fg/40 block">{s.part_d_level}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Questions tab */}
      {activeTab === 'questions' && (
        questionStats.length === 0 ? (
          <p className="text-center text-fg/40 mt-12">אין נתוני שאלות עדיין</p>
        ) : (
          <div className="space-y-2">
            {['1', '2'].map(part => (
              <div key={part}>
                <h3 className="font-semibold text-fg/80 mb-2 mt-4">
                  {part === '1' ? '📖 חלק א: 16 שאלות קשות' : '📚 חלק ב: 24 שאלות קשות מאוד'}
                </h3>
                {questionStats.filter(q => String(q.part) === part).map(q => (
                  <div key={q.question_id} className="bg-surface rounded-xl border border-card-border p-4 mb-2">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <p className="text-xs text-fg/40 mb-1">שאלה {q.q_order}</p>
                        <p className="text-sm text-fg/80 leading-relaxed line-clamp-2">{q.question_text}</p>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <div className={`text-2xl font-bold ${q.success_pct !== null ? (q.success_pct >= 70 ? 'text-green-600 dark:text-green-400' : q.success_pct >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400') : 'text-fg/30'}`}>
                          {q.success_pct !== null ? `${q.success_pct}%` : '—'}
                        </div>
                        <div className="text-xs text-fg/40">{q.correct}/{q.attempts}</div>
                      </div>
                    </div>
                    {q.attempts > 0 && (
                      <div className="mt-2 w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${(q.success_pct || 0) >= 70 ? 'bg-green-500' : (q.success_pct || 0) >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                          style={{ width: `${q.success_pct || 0}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      )}
    </>
  )
}
