'use client'

import { useRouter } from 'next/navigation'
import type { PracticeSet, Submission } from '@/lib/types'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import { CardGrid } from '@/components/ui/CardGrid'
import { Card, type AccentColor } from '@/components/ui/Card'

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
      title: 'סימולציה עברית',
      subtitle: 'חלק א+ב: הבנת הנקרא, חלק ג: משפטים, חלק ד: ראיון',
      accentColor: 'simulation',
      href: '/simulation',
    },
    {
      icon: '🧮',
      title: 'סימולציה דפ״ר',
      subtitle: '40 שאלות',
      accentColor: 'makbatzim',
      href: '/makbatzim/dapar-simulation',
    },
    {
      icon: '✍️',
      title: 'בניית משפטים',
      subtitle: '9 סטים, ציון ושיפור',
      accentColor: 'sentence',
      href: '/sentence',
    },
    {
      icon: '📖',
      title: 'תרגול הבנת הנקרא',
      subtitle: `${completedCount}/${sets.length} סטים הושלמו`,
      accentColor: 'reading',
      href: '/reading-sets',
    },
    {
      icon: '🧮',
      title: 'מקבצים פסיכוטכני',
      subtitle: '5 מקבצי שאלות',
      accentColor: 'makbatzim',
      href: '/makbatzim',
    },
  ]

  const homeCards: MenuCard[] = [
    {
      icon: '🎯',
      title: 'תרגול עצמי כמותי - עברית וערבית',
      subtitle: '300 שאלות: אחוזים, ממוצעים, תנועה, הסתברות',
      accentColor: 'tzav-rishon',
      href: '/tzav-rishon',
    },
    {
      icon: '🗣️',
      title: 'ראיון אישי',
      subtitle: 'סימולציית AI',
      accentColor: 'interview',
      href: '/interview',
    },
    {
      icon: '🤖',
      title: 'הבנת הנקרא',
      subtitle: 'תרגול עם AI',
      accentColor: 'ai-reading',
      href: '/ai-practice/reading',
    },
    {
      icon: '🤖',
      title: 'בניית משפט',
      subtitle: 'תרגול עם AI',
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
            <h1 className="text-xl font-bold text-fg">שלום, {session?.full_name}</h1>
            <p className="text-sm text-fg/60">{session?.class_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/student/personal-details')} className="text-sm text-fg/50 hover:text-fg">
              פרטים אישיים
            </button>
            <button onClick={handleLogout} className="text-sm text-fg/50 hover:text-fg">
              יציאה
            </button>
          </div>
        </div>

        <section>
          <h2 className="text-base font-bold text-fg mb-3">תרגול בכיתה</h2>
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
          <h2 className="text-base font-bold text-fg mb-3">תרגול בבית</h2>
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
