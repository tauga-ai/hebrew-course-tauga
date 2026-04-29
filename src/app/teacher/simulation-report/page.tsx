'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  const [className, setClassName] = useState('')
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'students' | 'questions'>('students')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/teacher/login'); return }
      const res = await fetch(`/api/teacher/simulation-report?email=${encodeURIComponent(user.email || '')}`)
      if (!res.ok) { router.replace('/teacher/dashboard'); return }
      const data = await res.json()
      setClassName(data.class_name)
      setSessions(data.sessions)
      setQuestionStats(data.question_stats)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">טוען...</p></div>

  const completed = sessions.filter(s => s.status === 'completed')
  const classAvgA = completed.length > 0 && completed.filter(s => s.part_a_pct !== null).length > 0
    ? Math.round(completed.filter(s => s.part_a_pct !== null).reduce((acc, s) => acc + (s.part_a_pct || 0), 0) / completed.filter(s => s.part_a_pct !== null).length)
    : null
  const classAvgB = completed.length > 0 && completed.filter(s => s.part_b_pct !== null).length > 0
    ? Math.round(completed.filter(s => s.part_b_pct !== null).reduce((acc, s) => acc + (s.part_b_pct || 0), 0) / completed.filter(s => s.part_b_pct !== null).length)
    : null

  const scoreColor = (v: number | null) => {
    if (v === null) return 'text-gray-300'
    return v >= 70 ? 'text-green-600' : v >= 50 ? 'text-yellow-600' : 'text-red-500'
  }

  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mt-4 mb-6">
        <button onClick={() => router.push('/teacher/dashboard')} className="text-sm text-gray-400 hover:text-gray-600">← חזרה</button>
        <div className="text-center">
          <h1 className="font-bold text-blue-700">דוח סימולציה</h1>
          <p className="text-xs text-gray-500">{className}</p>
        </div>
        <div />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-gray-800">{sessions.length}</div>
          <div className="text-xs text-gray-500">ניסיונות</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-gray-800">{completed.length}</div>
          <div className="text-xs text-gray-500">הושלמו</div>
        </div>
        <div className={`bg-white rounded-xl border border-gray-200 p-3 text-center`}>
          <div className={`text-2xl font-bold ${scoreColor(classAvgA)}`}>{classAvgA !== null ? `${classAvgA}%` : '—'}</div>
          <div className="text-xs text-gray-500">ממוצע חלק א</div>
        </div>
        <div className={`bg-white rounded-xl border border-gray-200 p-3 text-center`}>
          <div className={`text-2xl font-bold ${scoreColor(classAvgB)}`}>{classAvgB !== null ? `${classAvgB}%` : '—'}</div>
          <div className="text-xs text-gray-500">ממוצע חלק ב</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('students')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'students' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          תלמידים ({sessions.length})
        </button>
        <button onClick={() => setActiveTab('questions')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'questions' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          ניתוח שאלות ({questionStats.length})
        </button>
      </div>

      {/* Students tab */}
      {activeTab === 'students' && (
        sessions.length === 0 ? (
          <p className="text-center text-gray-400 mt-12">אין נתוני סימולציה עדיין</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-xl border border-gray-200 text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right p-3 font-semibold text-gray-700">תלמיד</th>
                  <th className="p-3 text-center font-semibold text-gray-700">סטטוס</th>
                  <th className="p-3 text-center font-semibold text-gray-700">חלק א (16)</th>
                  <th className="p-3 text-center font-semibold text-gray-700">חלק ב (24)</th>
                  <th className="p-3 text-center font-semibold text-gray-700">משפטים</th>
                  <th className="p-3 text-center font-semibold text-gray-700">ראיון</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={s.session_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-medium text-gray-800">{s.student_name}</td>
                    <td className="p-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {s.status === 'completed' ? 'הושלם' : 'בתהליך'}
                      </span>
                    </td>
                    <td className={`p-3 text-center font-semibold ${scoreColor(s.part_a_pct)}`}>
                      {s.part_a_pct !== null ? `${s.part_a_pct}%` : '—'}
                      {s.part_a_correct != null && <span className="text-xs text-gray-400 mr-1">({s.part_a_correct}/{s.part_a_total})</span>}
                    </td>
                    <td className={`p-3 text-center font-semibold ${scoreColor(s.part_b_pct)}`}>
                      {s.part_b_pct !== null ? `${s.part_b_pct}%` : '—'}
                      {s.part_b_correct != null && <span className="text-xs text-gray-400 mr-1">({s.part_b_correct}/{s.part_b_total})</span>}
                    </td>
                    <td className={`p-3 text-center font-semibold ${s.part_c_avg ? (parseFloat(s.part_c_avg) >= 7 ? 'text-green-600' : parseFloat(s.part_c_avg) >= 5 ? 'text-yellow-600' : 'text-red-500') : 'text-gray-300'}`}>
                      {s.part_c_avg ? `${s.part_c_avg}/10` : '—'}
                    </td>
                    <td className={`p-3 text-center font-semibold ${scoreColor(s.part_d_score)}`}>
                      {s.part_d_score !== null ? `${s.part_d_score}/100` : '—'}
                      {s.part_d_level && <span className="text-xs text-gray-400 block">{s.part_d_level}</span>}
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
          <p className="text-center text-gray-400 mt-12">אין נתוני שאלות עדיין</p>
        ) : (
          <div className="space-y-2">
            {['1', '2'].map(part => (
              <div key={part}>
                <h3 className="font-semibold text-gray-700 mb-2 mt-4">
                  {part === '1' ? '📖 חלק א — 16 שאלות קשות' : '📚 חלק ב — 24 שאלות קשות מאוד'}
                </h3>
                {questionStats.filter(q => String(q.part) === part).map(q => (
                  <div key={q.question_id} className="bg-white rounded-xl border border-gray-200 p-4 mb-2">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 mb-1">שאלה {q.q_order}</p>
                        <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">{q.question_text}</p>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <div className={`text-2xl font-bold ${q.success_pct !== null ? (q.success_pct >= 70 ? 'text-green-600' : q.success_pct >= 40 ? 'text-yellow-600' : 'text-red-500') : 'text-gray-300'}`}>
                          {q.success_pct !== null ? `${q.success_pct}%` : '—'}
                        </div>
                        <div className="text-xs text-gray-400">{q.correct}/{q.attempts}</div>
                      </div>
                    </div>
                    {q.attempts > 0 && (
                      <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
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
    </div>
  )
}
