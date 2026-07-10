'use client'

import { useRouter } from 'next/navigation'
import type { PracticeSet, Submission } from '@/lib/types'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import { CardGrid } from '@/components/ui/CardGrid'
import { Card } from '@/components/ui/Card'

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

        <CardGrid>
          <Card
            icon="📝"
            title='סימולציית דפ"ר'
            subtitle="הזנת תשובות לשאלות 1-50"
            accentColor="dapar"
            onClick={() => router.push('/dapar')}
          />
          <Card
            icon="🏆"
            title="סימולציה עברית"
            subtitle="חלק א+ב: הבנת הנקרא, חלק ג: משפטים, חלק ד: ראיון"
            accentColor="simulation"
            onClick={() => router.push('/simulation')}
          />
          <Card
            icon="🗣️"
            title="ראיון אישי"
            subtitle="סימולציית AI"
            accentColor="interview"
            onClick={() => router.push('/interview')}
          />
          <Card
            icon="✍️"
            title="בניית משפטים"
            subtitle="9 סטים, ציון ושיפור"
            accentColor="sentence"
            onClick={() => router.push('/sentence')}
          />
          <Card
            icon="🧠"
            title="פסיכוטכני: הזנת תשובות"
            subtitle="10 מקבצים, בדיקה מיידית, ציון ותיקון"
            accentColor="psychotechnic"
            onClick={() => router.push('/psychotechnic')}
          />
          <Card
            icon="🎯"
            title='דפ"ר לצו ראשון'
            subtitle="300 שאלות: אחוזים, ממוצעים, תנועה, הסתברות"
            accentColor="tzav-rishon"
            onClick={() => router.push('/tzav-rishon')}
          />
          <Card
            icon="📖"
            title="סטי הבנת הנקרא"
            subtitle={`${completedCount}/${sets.length} סטים הושלמו`}
            accentColor="reading"
            onClick={() => router.push('/reading-sets')}
          />
          <Card
            icon="🤖"
            title="הבנת הנקרא"
            subtitle="תרגול עם AI"
            accentColor="ai-reading"
            onClick={() => router.push('/ai-practice/reading')}
          />
          <Card
            icon="🤖"
            title="בניית משפט"
            subtitle="תרגול עם AI"
            accentColor="ai-sentence"
            onClick={() => router.push('/ai-practice/sentence')}
          />
          <Card
            icon="🧮"
            title="שאלות שעדי שלחה"
            subtitle="6 מקבצי שאלות"
            accentColor="makbatzim"
            onClick={() => router.push('/makbatzim')}
          />
        </CardGrid>
      </div>
    </div>
  )
}
