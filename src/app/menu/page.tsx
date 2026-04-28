'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentSession, PracticeSet, Submission } from '@/lib/types'

export default function Menu() {
  const router = useRouter()
  const [session, setSession] = useState<StudentSession | null>(null)
  const [sets, setSets] = useState<PracticeSet[]>([])
  const [completedSetIds, setCompletedSetIds] = useState<Set<number>>(new Set())
  const [submissions, setSubmissions] = useState<Record<number, Submission>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const raw = localStorage.getItem('student_session')
    if (!raw) { router.replace('/student'); return }
    const s: StudentSession = JSON.parse(raw)
    setSession(s)

    async function load() {
      const [setsRes, subsRes] = await Promise.all([
        fetch('/api/practice-sets'),
        fetch(`/api/student/${s.id}/submissions`),
      ])
      const setsData = await setsRes.json()
      const subsData = await subsRes.json()
      setSets(setsData.sets || [])

      const subMap: Record<number, Submission> = {}
      const doneIds = new Set<number>()
      for (const sub of subsData.submissions || []) {
        subMap[sub.practice_set_id] = sub
        doneIds.add(sub.practice_set_id)
      }
      setSubmissions(subMap)
      setCompletedSetIds(doneIds)
      setLoading(false)
    }
    load()
  }, [router])

  function handleLogout() {
    localStorage.removeItem('student_session')
    router.replace('/student')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">טוען...</p>
    </div>
  )

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6 mt-4">
        <div>
          <h1 className="text-xl font-bold text-blue-700">תרגול ניצנים</h1>
          <p className="text-sm text-gray-500">{session?.full_name} · {session?.class_name}</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600">
          יציאה
        </button>
      </div>

      {/* Quick access banners */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          onClick={() => router.push('/interview')}
          className="text-right bg-blue-600 rounded-xl p-4 hover:bg-blue-700 transition flex items-center justify-between"
        >
          <div>
            <div className="text-white font-bold text-sm">🗣️ ראיון אישי</div>
            <div className="text-blue-100 text-xs mt-0.5">סימולציית AI עם פידבק</div>
          </div>
          <span className="text-white">←</span>
        </button>
        <button
          onClick={() => router.push('/sentence')}
          className="text-right bg-purple-600 rounded-xl p-4 hover:bg-purple-700 transition flex items-center justify-between"
        >
          <div>
            <div className="text-white font-bold text-sm">✍️ בניית משפטים</div>
            <div className="text-purple-100 text-xs mt-0.5">9 סטים · ציון + שיפור</div>
          </div>
          <span className="text-white">←</span>
        </button>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-4">סטי הבנת הנקרא</h2>

      <div className="grid gap-3">
        {sets.map(set => {
          const done = completedSetIds.has(set.id)
          const sub = submissions[set.id]
          return (
            <button
              key={set.id}
              onClick={() => !done && router.push(`/practice/${set.id}`)}
              className={`w-full text-right rounded-xl border p-4 transition ${
                done
                  ? 'bg-green-50 border-green-200 cursor-default'
                  : 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-sm cursor-pointer'
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold text-gray-800">
                    סט {set.set_number}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">{set.topic}</div>
                  <div className="text-xs text-gray-400 mt-0.5">רמה {set.difficulty_level}</div>
                </div>
                <div className="text-left">
                  {done ? (
                    <div className="flex flex-col items-end">
                      <span className="text-green-600 font-bold text-lg">
                        {Math.round(sub.score_percentage)}%
                      </span>
                      <span className="text-xs text-green-500">הושלם</span>
                    </div>
                  ) : (
                    <span className="text-blue-500 text-sm font-medium">התחל ←</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
