'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface SentenceStat { set_id: number; attempts: number; avg_score: number | null }
interface InterviewStat { total: number; avg_score: number | null }
interface StudentRow {
  id: string; name: string
  sentence_attempts: number; sentence_avg: number | null
  interview_count: number; interview_avg: number | null
}

export default function ActivityPage() {
  const router = useRouter()
  const [sentenceStats, setSentenceStats] = useState<SentenceStat[]>([])
  const [interviewStats, setInterviewStats] = useState<InterviewStat | null>(null)
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/teacher/login'); return }

      const res = await fetch(`/api/teacher/activity?email=${encodeURIComponent(user.email || '')}`)
      if (!res.ok) { router.replace('/teacher/dashboard'); return }
      const data = await res.json()
      setSentenceStats(data.sentence_stats)
      setInterviewStats(data.interview_stats)
      setStudents(data.students)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">טוען...</p>
    </div>
  )

  const scoreColor = (s: number | null) => {
    if (s === null) return 'text-gray-400'
    return s >= 7 ? 'text-green-600' : s >= 5 ? 'text-yellow-600' : 'text-red-500'
  }

  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mt-4 mb-6">
        <button onClick={() => router.push('/teacher/dashboard')} className="text-sm text-gray-400 hover:text-gray-600">
          ← חזרה לדשבורד
        </button>
        <h1 className="font-bold text-blue-700">פעילות תלמידים</h1>
        <div />
      </div>

      {/* Interview summary */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <h2 className="font-semibold text-gray-800 mb-3">🎤 ראיון אישי</h2>
        <div className="flex gap-6">
          <div>
            <div className="text-2xl font-bold text-gray-800">{interviewStats?.total ?? 0}</div>
            <div className="text-xs text-gray-500">ניסיונות</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${scoreColor(interviewStats?.avg_score ?? null)}`}>
              {interviewStats?.avg_score != null ? `${Math.round(interviewStats.avg_score)}/100` : '—'}
            </div>
            <div className="text-xs text-gray-500">ממוצע</div>
          </div>
        </div>
      </div>

      {/* Sentence building by set */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <h2 className="font-semibold text-gray-800 mb-3">✍️ בניית משפטים — לפי סט</h2>
        <div className="grid grid-cols-3 gap-2">
          {sentenceStats.map(s => (
            <div key={s.set_id} className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">סט {s.set_id}</div>
              <div className={`text-lg font-bold ${scoreColor(s.avg_score)}`}>
                {s.avg_score != null ? `${s.avg_score.toFixed(1)}/10` : '—'}
              </div>
              <div className="text-xs text-gray-400">{s.attempts} ניסיונות</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-student table */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-3">👤 פירוט לפי תלמיד</h2>
        {students.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">אין נתונים עדיין</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right p-2 font-semibold text-gray-700">תלמיד</th>
                  <th className="p-2 text-center font-semibold text-gray-700">משפטים (ניסיונות)</th>
                  <th className="p-2 text-center font-semibold text-gray-700">ממוצע משפטים</th>
                  <th className="p-2 text-center font-semibold text-gray-700">ראיונות</th>
                  <th className="p-2 text-center font-semibold text-gray-700">ממוצע ראיון</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st, i) => (
                  <tr key={st.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-2 font-medium text-gray-800">{st.name}</td>
                    <td className="p-2 text-center text-gray-600">{st.sentence_attempts}</td>
                    <td className={`p-2 text-center font-semibold ${scoreColor(st.sentence_avg)}`}>
                      {st.sentence_avg != null ? `${st.sentence_avg.toFixed(1)}/10` : '—'}
                    </td>
                    <td className="p-2 text-center text-gray-600">{st.interview_count}</td>
                    <td className={`p-2 text-center font-semibold ${scoreColor(st.interview_avg != null ? st.interview_avg / 10 : null)}`}>
                      {st.interview_avg != null ? `${Math.round(st.interview_avg)}/100` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
