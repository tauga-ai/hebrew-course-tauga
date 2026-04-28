'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SENTENCE_SETS, DIFFICULTY_COLORS } from '@/lib/sentence-exercises'
import type { StudentSession } from '@/lib/types'

export default function SentenceLanding() {
  const router = useRouter()
  const [session, setSession] = useState<StudentSession | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('student_session')
    if (!raw) { router.replace('/student'); return }
    setSession(JSON.parse(raw))
  }, [router])

  const difficultyLabel: Record<number, string> = {
    1: 'בסיסי', 2: 'בינוני', 3: 'מורכב', 4: 'מתקדם', 5: 'גבוה',
  }

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mt-4 mb-8">
        <button onClick={() => router.push('/menu')} className="text-sm text-gray-400 hover:text-gray-600">
          ← חזרה לתפריט
        </button>
        <div className="text-sm text-gray-500">{session?.full_name}</div>
      </div>

      <div className="text-center mb-8">
        <div className="text-5xl mb-3">✍️</div>
        <h1 className="text-2xl font-bold text-blue-700 mb-2">בניית משפטים</h1>
        <p className="text-gray-500 text-sm">בחר סט, קבל רשימת מילים, ובנה משפט. AI יעריך ויציע שיפורים.</p>
      </div>

      <div className="grid gap-3">
        {SENTENCE_SETS.map(set => (
          <button
            key={set.id}
            onClick={() => router.push(`/sentence/${set.id}`)}
            className="w-full text-right bg-white rounded-2xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-gray-800">{set.title}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${DIFFICULTY_COLORS[set.difficulty]}`}>
                    {difficultyLabel[set.difficulty]}
                  </span>
                  <span className="text-xs text-gray-400">10 תרגילים</span>
                </div>
              </div>
              <span className="text-blue-400 text-xl group-hover:translate-x-1 transition-transform">←</span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 bg-gray-50 rounded-xl p-4 text-sm text-gray-500 text-right">
        <p className="font-medium text-gray-700 mb-1">📌 איך זה עובד?</p>
        <p>בכל תרגיל תקבל 12 מילים. מילים <strong>מסומנות בכוכב</strong> הן חובה. בנה משפט שמשתמש בכולן ובלפחות 6 מילים מהרשימה. לבסוף תקבל ציון ומשוב.</p>
      </div>
    </div>
  )
}
