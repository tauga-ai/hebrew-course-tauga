'use client'

import { useRouter } from 'next/navigation'
import type { PracticeSet, Submission } from '@/lib/types'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import { CardGrid } from '@/components/ui/CardGrid'
import { Card, type AccentColor } from '@/components/ui/Card'
import { t } from '@/lib/dev-i18n'

interface MenuCard {
  icon: string
  title: string
  subtitle: string
  accentColor: AccentColor
  href: string
}

export default function Menu() {
  const router = useRouter()
  const { session } = useStudentSession()

  const { data: setsData, loading: setsLoading } = useResource<{ sets: PracticeSet[] }>(
    session ? '/api/practice-sets' : null, { fallback: { sets: [] } }
  )
  const { data: subsData, loading: subsLoading } = useResource<{ submissions: Submission[] }>(
    session ? `/api/student/${session.id}/submissions` : null, { fallback: { submissions: [] } }
  )
  const sets = setsData?.sets ?? []
  const completedCount = subsData?.submissions?.length ?? 0

  function handleLogout() {
    localStorage.removeItem('student_session')
    router.replace('/student')
  }

  if (setsLoading || subsLoading) return <LoadingSpinner />

  const classroomCards: MenuCard[] = [
    {
      icon: '🏆',
      title: t('סימולציה עברית'),
      subtitle: t('חלק א+ב: הבנת הנקרא, חלק ג: משפטים, חלק ד: ראיון'),
      accentColor: 'simulation',
      href: '/simulation',
    },
    {
      icon: '🧮',
      title: t('סימולציה דפ״ר'),
      subtitle: t('40 שאלות'),
      accentColor: 'makbatzim',
      href: '/makbatzim/dapar-simulation',
    },
    {
      icon: '✍️',
      title: t('בניית משפטים'),
      subtitle: t('9 סטים, ציון ושיפור'),
      accentColor: 'sentence',
      href: '/sentence',
    },
    {
      icon: '📖',
      title: t('תרגול הבנת הנקרא'),
      subtitle: `${completedCount}/${sets.length} ${t('סטים הושלמו')}`,
      accentColor: 'reading',
      href: '/reading-sets',
    },
    {
      icon: '🧮',
      title: t('מקבצים פסיכוטכני'),
      subtitle: t('5 מקבצי שאלות'),
      accentColor: 'makbatzim',
      href: '/makbatzim',
    },
  ]

  const homeCards: MenuCard[] = [
    {
      icon: '🎯',
      title: t('תרגול עצמי כמותי - עברית וערבית'),
      subtitle: t('300 שאלות: אחוזים, ממוצעים, תנועה, הסתברות'),
      accentColor: 'tzav-rishon',
      href: '/tzav-rishon',
    },
    {
      icon: '🗣️',
      title: t('ראיון אישי'),
      subtitle: t('סימולציית AI'),
      accentColor: 'interview',
      href: '/interview',
    },
    {
      icon: '🤖',
      title: t('הבנת הנקרא'),
      subtitle: t('תרגול עם AI'),
      accentColor: 'ai-reading',
      href: '/ai-practice/reading',
    },
    {
      icon: '🤖',
      title: t('בניית משפט'),
      subtitle: t('תרגול עם AI'),
      accentColor: 'ai-sentence',
      href: '/ai-practice/sentence',
    },
  ]

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />

      <div className="flex-1 p-4 max-w-5xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6 mt-4">
          <div>
            <h1 className="text-xl font-bold text-fg">{t('שלום')}, {session?.full_name}</h1>
            <p className="text-sm text-fg/60">{session?.class_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/student/personal-details')} className="text-sm text-fg/50 hover:text-fg">
              {t('פרטים אישיים')}
            </button>
            <button onClick={handleLogout} className="text-sm text-fg/50 hover:text-fg">
              {t('יציאה')}
            </button>
          </div>
        </div>

        <section>
          <h2 className="text-base font-bold text-fg mb-3">{t('תרגול בכיתה')}</h2>
          <CardGrid>
            {classroomCards.map(c => (
              <Card
                key={c.href}
                icon={c.icon}
                title={c.title}
                subtitle={c.subtitle}
                accentColor={c.accentColor}
                href={c.href}
                onClick={() => router.push(c.href)}
              />
            ))}
          </CardGrid>
        </section>

        <section className="mt-8">
          <h2 className="text-base font-bold text-fg mb-3">{t('תרגול בבית')}</h2>
          <CardGrid>
            {homeCards.map(c => (
              <Card
                key={c.href}
                icon={c.icon}
                title={c.title}
                subtitle={c.subtitle}
                accentColor={c.accentColor}
                href={c.href}
                onClick={() => router.push(c.href)}
              />
            ))}
          </CardGrid>
        </section>
      </div>
    </div>
  )
}
