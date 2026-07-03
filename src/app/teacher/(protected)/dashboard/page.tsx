'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTeacherAuth } from '@/lib/hooks/use-teacher-auth'
import { LoadingSpinner } from '@/components/LoadingSpinner'

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
  const { email } = useTeacherAuth()
  const [className, setClassName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [stats, setStats] = useState<SetStats[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!email) return
    async function load() {
      const res = await fetch('/api/teacher/stats')
      const data = await res.json()
      if (!res.ok) { router.replace('/teacher/login'); return }
      setClassName(data.class_name)
      setJoinCode(data.join_code)
      setStats(data.stats)
      setLoading(false)
    }
    load()
  }, [email, router])

  function handleCopyCode() {
    navigator.clipboard.writeText(joinCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return <LoadingSpinner />

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary-700">לוח בקרה - מורה</h1>
        <p className="text-sm text-gray-500">{className} · {email}</p>
      </div>

      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-primary-600 mb-1">קוד הצטרפות לכיתה — לשלוח לתלמידים חדשים</p>
          <p className="text-2xl font-bold text-primary-800 tracking-widest">{joinCode}</p>
        </div>
        <button
          onClick={handleCopyCode}
          className="text-sm bg-white border border-primary-300 text-primary-700 px-3 py-1.5 rounded-lg hover:bg-primary-100"
        >
          {copied ? 'הועתק!' : 'העתק'}
        </button>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-4">סיכום סטים</h2>

      <div className="grid gap-3">
        {stats.map(s => (
          <button
            key={s.set_id}
            onClick={() => router.push(`/teacher/sets/${s.set_id}`)}
            className="w-full text-right bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-300 hover:shadow-sm transition cursor-pointer"
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
                <span className="text-primary-400 text-lg">←</span>
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
    </>
  )
}
