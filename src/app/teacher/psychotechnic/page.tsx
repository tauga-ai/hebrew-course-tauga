'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PSYCHOTECHNIC_SETS } from '@/lib/psychotechnic'

interface Submission {
  id: string; student_name: string; student_id: string
  set_id: number; set_name: string
  answers: number[]; score: number; total: number; pct: number; submitted_at: string
}
interface QuestionStat {
  question: number; correct_answer: number; total_answers: number
  correct_count: number; success_pct: number | null
  distribution: Record<string, number>
}
interface SetSummary { set_id: number; set_name: string; submissions_count: number; avg_pct: number | null }

export default function PsychotechnicTeacherPage() {
  const router = useRouter()
  const [className, setClassName] = useState('')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [setsSummary, setSetsSummary] = useState<SetSummary[]>([])
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [tab, setTab] = useState<'sets' | 'students' | 'questions'>('sets')

  async function loadData(setId: number | null) {
    const url = `/api/teacher/psychotechnic?email=${encodeURIComponent(email)}${setId ? `&set_id=${setId}` : ''}`
    const res = await fetch(url)
    if (!res.ok) return
    const data = await res.json()
    setClassName(data.class_name)
    setSubmissions(data.submissions)
    setQuestionStats(data.question_stats)
    setSetsSummary(data.sets_summary)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/teacher/login'); return }
      setEmail(user.email || '')
      const res = await fetch(`/api/teacher/psychotechnic?email=${encodeURIComponent(user.email || '')}`)
      if (!res.ok) { router.replace('/teacher/dashboard'); return }
      const data = await res.json()
      setClassName(data.class_name)
      setSubmissions(data.submissions)
      setQuestionStats(data.question_stats)
      setSetsSummary(data.sets_summary)
      setLoading(false)
    }
    init()
  }, [router])

  async function handleSetSelect(id: number | null) {
    setSelectedSetId(id)
    setLoading(true)
    await loadData(id)
    setLoading(false)
    if (id) setTab('questions')
  }

  const scoreColor = (v: number | null) => {
    if (v === null) return 'text-gray-300'
    return v >= 70 ? 'text-green-600' : v >= 50 ? 'text-yellow-600' : 'text-red-500'
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">טוען...</p></div>

  const filteredSubs = selectedSetId ? submissions.filter(s => s.set_id === selectedSetId) : submissions
  const selectedSetName = selectedSetId ? PSYCHOTECHNIC_SETS.find(s => s.id === selectedSetId)?.name : null

  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mt-4 mb-6">
        <button onClick={() => router.push('/teacher/dashboard')} className="text-sm text-gray-400 hover:text-gray-600">← חזרה</button>
        <div className="text-center">
          <h1 className="font-bold text-blue-700">דוח פסיכוטכני</h1>
          <p className="text-xs text-gray-500">{className}</p>
        </div>
        <div />
      </div>

      {/* Set selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <label className="text-sm font-medium text-gray-700 block mb-2">סנן לפי מקבץ:</label>
        <select
          value={selectedSetId || ''}
          onChange={e => handleSetSelect(e.target.value ? Number(e.target.value) : null)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-right bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">כל המקבצים</option>
          {PSYCHOTECHNIC_SETS.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {selectedSetName && (
          <p className="text-xs text-blue-600 mt-1">{filteredSubs.length} הגשות ל{selectedSetName}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('sets')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'sets' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          סיכום מקבצים
        </button>
        <button onClick={() => setTab('students')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'students' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          לפי תלמיד ({filteredSubs.length})
        </button>
        {selectedSetId && (
          <button onClick={() => setTab('questions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'questions' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            ניתוח שאלות
          </button>
        )}
      </div>

      {/* Sets summary tab */}
      {tab === 'sets' && (
        setsSummary.length === 0 ? (
          <p className="text-center text-gray-400 mt-12">אין נתונים עדיין</p>
        ) : (
          <div className="grid gap-3">
            {setsSummary.map(s => (
              <button key={s.set_id} onClick={() => handleSetSelect(s.set_id)}
                className="w-full text-right bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-gray-800">{s.set_name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.submissions_count} הגשות</div>
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

      {/* Students tab */}
      {tab === 'students' && (
        filteredSubs.length === 0 ? (
          <p className="text-center text-gray-400 mt-12">אין הגשות</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-xl border border-gray-200 text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right p-3 font-semibold text-gray-700">תלמיד</th>
                  <th className="p-3 text-right font-semibold text-gray-700">מקבץ</th>
                  <th className="p-3 text-center font-semibold text-gray-700">ציון</th>
                  <th className="p-3 text-center font-semibold text-gray-700">%</th>
                  <th className="p-3 text-center font-semibold text-gray-700">התשובות</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubs.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-medium text-gray-800">{s.student_name}</td>
                    <td className="p-3 text-gray-600 text-sm">{s.set_name}</td>
                    <td className="p-3 text-center font-semibold text-gray-800">{s.score}/{s.total}</td>
                    <td className={`p-3 text-center font-bold ${scoreColor(s.pct)}`}>{s.pct}%</td>
                    <td className="p-3 text-center">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {(s.answers as number[]).map((a, qi) => {
                          const set = PSYCHOTECHNIC_SETS.find(ps => ps.id === s.set_id)
                          const correct = set?.answers[qi]
                          return (
                            <span key={qi} className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                              a === correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                            }`}>
                              {qi+1}:{a}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Questions tab */}
      {tab === 'questions' && selectedSetId && (
        questionStats.length === 0 ? (
          <p className="text-center text-gray-400 mt-12">אין נתוני שאלות עדיין</p>
        ) : (
          <div className="space-y-3">
            {questionStats.map(q => (
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

                {/* Distribution bars */}
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
        )
      )}
    </div>
  )
}
