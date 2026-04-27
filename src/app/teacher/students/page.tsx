'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

export default function StudentsPage() {
  const router = useRouter()
  const [className, setClassName] = useState('')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [setHeaders, setSetHeaders] = useState<SetHeader[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/teacher/login'); return }

      const res = await fetch(`/api/teacher/students?email=${encodeURIComponent(user.email || '')}`)
      const data = await res.json()
      if (!res.ok) { router.replace('/teacher/login'); return }
      setClassName(data.class_name)
      setStudents(data.students)
      setSetHeaders(data.set_headers)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">טוען...</p>
    </div>
  )

  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mt-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-blue-700">ניתוח תלמידים</h1>
          <p className="text-sm text-gray-500">{className}</p>
        </div>
        <button onClick={() => router.push('/teacher/dashboard')} className="text-sm text-gray-400 hover:text-gray-600">
          ← חזרה
        </button>
      </div>

      {students.length === 0 ? (
        <p className="text-center text-gray-400 mt-16">אין תלמידים עדיין</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-xl border border-gray-200 text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-right p-3 font-semibold text-gray-700">תלמיד</th>
                {setHeaders.map(h => (
                  <th key={h.set_number} className="p-3 font-semibold text-gray-700 text-center whitespace-nowrap">
                    סט {h.set_number}
                  </th>
                ))}
                <th className="p-3 font-semibold text-gray-700 text-center">ממוצע</th>
              </tr>
            </thead>
            <tbody>
              {students.map((st, i) => (
                <tr key={st.student_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 font-medium text-gray-800 border-b border-gray-100">{st.full_name}</td>
                  {setHeaders.map(h => {
                    const result = st.sets.find(s => s.set_number === h.set_number)
                    return (
                      <td key={h.set_number} className="p-3 text-center border-b border-gray-100">
                        {result ? (
                          <span className={`font-semibold ${result.score_percentage >= 70 ? 'text-green-600' : 'text-red-500'}`}>
                            {Math.round(result.score_percentage)}%
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="p-3 text-center border-b border-gray-100">
                    {st.overall_avg !== null ? (
                      <span className={`font-bold ${st.overall_avg >= 70 ? 'text-green-600' : 'text-red-500'}`}>
                        {Math.round(st.overall_avg)}%
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
