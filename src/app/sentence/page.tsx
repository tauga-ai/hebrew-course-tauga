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
    1: 'רמה 1', 2: 'רמה 2', 3: 'רמה 3', 4: 'רמה 4', 5: 'רמה 5',
  }

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mt-4 mb-8">
        <button onClick={() => router.push('/menu')} className="text-sm text-gray-400 hover:text-gray-600">
          ← חזרה לתפריט
        </button>
        <div className="text-sm text-gray-500">{session?.full_name}</div>
      </div>

      <div className="text-center mb-5">
        <div className="text-5xl mb-3">✍️</div>
        <h1 className="text-2xl font-bold text-blue-700 mb-2">בניית משפטים</h1>
      </div>

      {/* How it works — at top */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-right">
        <p className="font-semibold text-blue-800 mb-2">📌 איך זה עובד?</p>
        <ol className="space-y-1 text-blue-700 list-decimal list-inside">
          <li>בכל תרגיל מוצגות <strong>12 מילים</strong></li>
          <li>מילים <strong className="text-blue-900">★ מסומנות בכחול — חובה</strong> להשתמש בהן</li>
          <li>השתמש בלפחות <strong>6 מילים</strong> מהרשימה הכללית</li>
          <li>כתוב את המשפט או הכתב בקול</li>
          <li>תקבל ציון + משוב + גרסה מושלמת עם הקראה</li>
        </ol>
        <p className="text-blue-600 text-xs mt-2">💡 צורות שונות של מילה נספרות — למשל ״חברים״ וגם ״חבריי״</p>
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
                  <span className="font-bold text-gray-800">סט {set.id}</span>
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

    </div>
  )
}
