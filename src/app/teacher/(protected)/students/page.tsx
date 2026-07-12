'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTeacherAuth } from '@/lib/hooks/use-teacher-auth'
import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { scoreColor } from '@/lib/score-color'

interface StudentRow {
  student_id: string
  full_name: string
  sets: { set_number: number; score_percentage: number }[]
  overall_avg: number | null
}

interface SetHeader {
  set_number: number
  topic: string
}

interface StudentsData {
  class_name: string
  students: StudentRow[]
  set_headers: SetHeader[]
}

interface SetStats {
  set_id: number
  set_number: number
  topic: string
  difficulty_level: number
  student_count: number
  avg_score: number | null
}

interface TeacherStats {
  stats: SetStats[]
}

export default function StudentsPage() {
  const router = useRouter()
  const { email } = useTeacherAuth()
  const { data, loading, error } = useResource<StudentsData>(email ? '/api/teacher/students' : null)
  const { data: statsData, loading: statsLoading } = useResource<TeacherStats>(email ? '/api/teacher/stats' : null)
  const className = data?.class_name ?? ''
  const students = data?.students ?? []
  const setHeaders = data?.set_headers ?? []
  const sets = statsData?.stats ?? []

  useEffect(() => {
    if (error) router.replace('/teacher/login')
  }, [error, router])

  if (loading || statsLoading) return <LoadingSpinner />

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary-700 dark:text-primary-400">הבנת הנקרא</h1>
        <p className="text-sm text-fg/60">{className}</p>
      </div>

      <h2 className="text-lg font-semibold text-fg mb-4">סיכום סטים</h2>
      <div className="grid gap-3 mb-8">
        {sets.map(s => (
          <button
            key={s.set_id}
            onClick={() => router.push(`/teacher/sets/${s.set_id}`)}
            className="w-full text-right bg-surface rounded-xl border border-card-border p-4 hover:border-primary-300 hover:shadow-sm transition cursor-pointer"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold text-fg">סט {s.set_number}</div>
                <div className="text-sm text-fg/60 mt-0.5">{s.topic}</div>
                <div className="text-xs text-fg/40 mt-0.5">רמה {s.difficulty_level}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-left space-y-1">
                  <div className="text-sm text-fg/70">
                    <span className="font-bold text-fg">{s.student_count}</span> תלמידים השלימו
                  </div>
                  <div className="text-sm text-fg/70">
                    ממוצע:{' '}
                    <span className={`font-bold ${scoreColor(s.avg_score, { emptyClass: 'text-fg/40' })}`}>
                      {s.avg_score === null ? '—' : `${Math.round(s.avg_score)}%`}
                    </span>
                  </div>
                </div>
                <span className="text-primary-400 text-lg">←</span>
              </div>
            </div>
            {s.avg_score !== null && (
              <div className="mt-3 w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${scoreColor(s.avg_score, { palette: { good: 'bg-green-500', ok: 'bg-yellow-400', bad: 'bg-red-400' } })}`}
                  style={{ width: `${s.avg_score}%` }}
                />
              </div>
            )}
          </button>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-fg mb-4">ניתוח תלמידים</h2>

      {students.length === 0 ? (
        <p className="text-center text-fg/40 mt-16">אין תלמידים עדיין</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-surface rounded-xl border border-card-border text-sm">
            <thead>
              <tr className="bg-black/5 dark:bg-white/5 border-b border-card-border">
                <th className="text-right p-3 font-semibold text-fg/80">תלמיד</th>
                {setHeaders.map(h => (
                  <th key={h.set_number} className="p-3 font-semibold text-fg/80 text-center whitespace-nowrap">
                    סט {h.set_number}
                  </th>
                ))}
                <th className="p-3 font-semibold text-fg/80 text-center">ממוצע</th>
              </tr>
            </thead>
            <tbody>
              {students.map((st, i) => (
                <tr key={st.student_id} className={i % 2 === 0 ? 'bg-surface' : 'bg-black/5 dark:bg-white/5'}>
                  <td className="p-3 font-medium text-fg border-b border-card-border">{st.full_name}</td>
                  {setHeaders.map(h => {
                    const result = st.sets.find(s => s.set_number === h.set_number)
                    return (
                      <td key={h.set_number} className="p-3 text-center border-b border-card-border">
                        {result ? (
                          <span className={`font-semibold ${scoreColor(result.score_percentage)}`}>
                            {Math.round(result.score_percentage)}%
                          </span>
                        ) : (
                          <span className="text-fg/30">—</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="p-3 text-center border-b border-card-border">
                    {st.overall_avg !== null ? (
                      <span className={`font-bold ${scoreColor(st.overall_avg)}`}>
                        {Math.round(st.overall_avg)}%
                      </span>
                    ) : (
                      <span className="text-fg/30">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
