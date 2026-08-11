'use client'

import { useRouter } from 'next/navigation'
import { SENTENCE_SETS, DIFFICULTY_COLORS } from '@/lib/sentence-exercises'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { PageHeader } from '@/components/PageHeader'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import { CardGrid } from '@/components/ui/CardGrid'
import { Card } from '@/components/ui/Card'
import { t } from '@/lib/dev-i18n'

export default function SentenceLanding() {
  const router = useRouter()
  const { session } = useStudentSession()

  const difficultyLabel: Record<number, string> = {
    1: t('רמה 1'), 2: t('רמה 2'), 3: t('רמה 3'), 4: t('רמה 4'), 5: t('רמה 5'),
  }

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
      <PageHeader backHref="/menu" backLabel={t('← חזרה לתפריט')} right={session?.full_name} />

      <div className="text-center mb-5">
        <div className="text-5xl mb-3">✍️</div>
        <h1 className="text-2xl font-bold text-primary-700 dark:text-primary-400 mb-2">{t('בניית משפטים')}</h1>
        <button
          onClick={() => router.push('/sentence/history')}
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          {t('📜 ההיסטוריה שלי')}
        </button>
      </div>

      {/* How it works — at top */}
      <div className="bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-800 rounded-xl p-4 mb-6 text-sm text-right">
        <p className="font-semibold text-primary-800 dark:text-primary-300 mb-2">{t('📌 איך זה עובד?')}</p>
        <ol className="space-y-1 text-primary-700 dark:text-primary-400 list-decimal list-inside">
          <li>{t('בכל תרגיל מוצגות')} <strong>{t('12 מילים')}</strong></li>
          <li>{t('מילים')} <strong className="text-blue-900 dark:text-blue-300">{t('★ מסומנות בכחול: חובה')}</strong> {t('להשתמש בהן')}</li>
          <li>{t('השתמש בלפחות')} <strong>{t('6 מילים')}</strong> {t('מהרשימה הכללית')}</li>
          <li>{t('כתוב את המשפט או הקלט את עצמך')}</li>
          <li>{t('תקבל ציון + משוב + גרסה מושלמת עם הקראה')}</li>
        </ol>
        <p className="text-primary-600 dark:text-primary-400 text-xs mt-2">{t('💡 צורות שונות של מילה נספרות, למשל ״חברים״ וגם ״חבריי״')}</p>
      </div>

      <CardGrid>
        {SENTENCE_SETS.map(set => (
          <Card
            key={set.id}
            icon="✍️"
            title={`${t('סט')} ${set.id}`}
            subtitle={t('10 תרגילים')}
            accentColor="sentence"
            href={`/sentence/${set.id}`}
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
