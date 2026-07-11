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

export default function StudentsPage() {
  const router = useRouter()
  const { email } = useTeacherAuth()
  const { data, loading, error } = useResource<StudentsData>(email ? '/api/teacher/students' : null)
  const className = data?.class_name ?? ''
  const students = data?.students ?? []
  const setHeaders = data?.set_headers ?? []

  useEffect(() => {
    if (error) router.replace('/teacher/login')
  }, [error, router])

  if (loading) return <LoadingSpinner />

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary-700 dark:text-primary-400">ניתוח תלמידים</h1>
        <p className="text-sm text-fg/60">{className}</p>
      </div>

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
