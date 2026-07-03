'use client'

import { useRouter } from 'next/navigation'
import { SENTENCE_SETS, DIFFICULTY_COLORS } from '@/lib/sentence-exercises'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { PageHeader } from '@/components/PageHeader'

export default function SentenceLanding() {
  const router = useRouter()
  const { session } = useStudentSession()

  const difficultyLabel: Record<number, string> = {
    1: 'רמה 1', 2: 'רמה 2', 3: 'רמה 3', 4: 'רמה 4', 5: 'רמה 5',
  }

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <PageHeader backHref="/menu" backLabel="← חזרה לתפריט" right={session?.full_name} />

      <div className="text-center mb-5">
        <div className="text-5xl mb-3">✍️</div>
        <h1 className="text-2xl font-bold text-primary-700 mb-2">בניית משפטים</h1>
      </div>

      {/* How it works — at top */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-6 text-sm text-right">
        <p className="font-semibold text-primary-800 mb-2">📌 איך זה עובד?</p>
        <ol className="space-y-1 text-primary-700 list-decimal list-inside">
          <li>בכל תרגיל מוצגות <strong>12 מילים</strong></li>
          <li>מילים <strong className="text-blue-900">★ מסומנות בכחול — חובה</strong> להשתמש בהן</li>
          <li>השתמש בלפחות <strong>6 מילים</strong> מהרשימה הכללית</li>
          <li>כתוב את המשפט או הקלט את עצמך</li>
          <li>תקבל ציון + משוב + גרסה מושלמת עם הקראה</li>
        </ol>
        <p className="text-primary-600 text-xs mt-2">💡 צורות שונות של מילה נספרות — למשל ״חברים״ וגם ״חבריי״</p>
      </div>

      <div className="grid gap-3">
        {SENTENCE_SETS.map(set => (
          <button
            key={set.id}
            onClick={() => router.push(`/sentence/${set.id}`)}
            className="w-full text-right bg-white rounded-2xl border border-gray-200 p-5 hover:border-primary-300 hover:shadow-sm transition group"
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
              <span className="text-primary-400 text-xl group-hover:translate-x-1 transition-transform">←</span>
            </div>
          </button>
        ))}
      </div>

    </div>
  )
}
