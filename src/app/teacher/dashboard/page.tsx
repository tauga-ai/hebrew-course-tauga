'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface SetStats {
  set_id: number
  set_number: number
  topic: string
  difficulty_level: number
  student_count: number
  avg_score: number | null
}

export default function TeacherDashboard() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [className, setClassName] = useState('')
  const [stats, setStats] = useState<SetStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/teacher/login'); return }
      setEmail(user.email || '')

      const res = await fetch(`/api/teacher/stats?email=${encodeURIComponent(user.email || '')}`)
      const data = await res.json()
      if (!res.ok) { router.replace('/teacher/login'); return }
      setClassName(data.class_name)
      setStats(data.stats)
      setLoading(false)
    }
    load()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/teacher/login')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">טוען...</p>
    </div>
  )

  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mt-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-blue-700">לוח בקרה - מורה</h1>
          <p className="text-sm text-gray-500">{className} · {email}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/teacher/students')}
            className="text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100"
          >
            הבנת הנקרא
          </button>
          <button
            onClick={() => router.push('/teacher/activity')}
            className="text-sm bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-100"
          >
            משפטים + ראיון
          </button>
          <button
            onClick={() => router.push('/teacher/simulation-report')}
            className="text-sm bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg hover:bg-orange-100"
          >
            🏆 סימולציה
          </button>
          <button
            onClick={() => router.push('/teacher/psychotechnic')}
            className="text-sm bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg hover:bg-teal-100"
          >
            🧠 פסיכוטכני
          </button>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600">
            יציאה
          </button>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-4">סיכום סטים</h2>

      <div className="grid gap-3">
        {stats.map(s => (
          <button
            key={s.set_id}
            onClick={() => router.push(`/teacher/sets/${s.set_id}`)}
            className="w-full text-right bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition cursor-pointer"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold text-gray-800">סט {s.set_number}</div>
                <div className="text-sm text-gray-500 mt-0.5">{s.topic}</div>
                <div className="text-xs text-gray-400 mt-0.5">רמה {s.difficulty_level}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-left space-y-1">
                  <div className="text-sm text-gray-600">
                    <span className="font-bold text-gray-800">{s.student_count}</span> תלמידים השלימו
                  </div>
                  <div className="text-sm text-gray-600">
                    ממוצע:{' '}
                    <span className={`font-bold ${
                      s.avg_score === null ? 'text-gray-400' :
                      s.avg_score >= 70 ? 'text-green-600' : 'text-red-500'
                    }`}>
                      {s.avg_score === null ? '—' : `${Math.round(s.avg_score)}%`}
                    </span>
                  </div>
                </div>
                <span className="text-blue-400 text-lg">←</span>
              </div>
            </div>
            {s.avg_score !== null && (
              <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${s.avg_score >= 70 ? 'bg-green-500' : 'bg-red-400'}`}
                  style={{ width: `${s.avg_score}%` }}
                />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
