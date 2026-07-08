'use client'

import { useRouter } from 'next/navigation'
import { SENTENCE_SETS, DIFFICULTY_COLORS } from '@/lib/sentence-exercises'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { PageHeader } from '@/components/PageHeader'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import { CardGrid } from '@/components/ui/CardGrid'
import { Card } from '@/components/ui/Card'

export default function SentenceLanding() {
  const router = useRouter()
  const { session } = useStudentSession()

  const difficultyLabel: Record<number, string> = {
    1: 'רמה 1', 2: 'רמה 2', 3: 'רמה 3', 4: 'רמה 4', 5: 'רמה 5',
  }

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
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
          <li>מילים <strong className="text-blue-900">★ מסומנות בכחול: חובה</strong> להשתמש בהן</li>
          <li>השתמש בלפחות <strong>6 מילים</strong> מהרשימה הכללית</li>
          <li>כתוב את המשפט או הקלט את עצמך</li>
          <li>תקבל ציון + משוב + גרסה מושלמת עם הקראה</li>
        </ol>
        <p className="text-primary-600 text-xs mt-2">💡 צורות שונות של מילה נספרות, למשל ״חברים״ וגם ״חבריי״</p>
      </div>

      <CardGrid>
        {SENTENCE_SETS.map(set => (
          <Card
            key={set.id}
            icon="✍️"
            title={`סט ${set.id}`}
            subtitle="10 תרגילים"
            accentColor="sentence"
            onClick={() => router.push(`/sentence/${set.id}`)}
            trailing={
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${DIFFICULTY_COLORS[set.difficulty]}`}>
                {difficultyLabel[set.difficulty]}
              </span>
            }
          />
        ))}
      </CardGrid>
      </div>
    </div>
  )
}
