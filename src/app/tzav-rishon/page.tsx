'use client'

import { useRouter } from 'next/navigation'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { useLanguage } from '@/components/tzav-rishon/LanguageContext'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import { CardGrid } from '@/components/ui/CardGrid'
import { Card } from '@/components/ui/Card'

interface TopicMeta {
  key: string
  labelHe: string
  labelAr: string
  count: number
}

export default function TzavRishonTopicsPage() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useStudentSession()
  const { language, setLanguage } = useLanguage()
  const { data } = useResource<{ topics: TopicMeta[] }>(session ? '/api/tzav-rishon/topics' : null, { fallback: { topics: [] } })
  const topics = data?.topics ?? null

  if (sessionLoading || topics === null) return <LoadingSpinner />

  const isAr = language === 'ar'

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />
      <div lang={isAr ? 'ar' : 'he'} className="flex-1 p-4 max-w-md mx-auto w-full">
      <PageHeader
        backHref="/menu"
        title={isAr ? 'دفار للاستدعاء الأول' : 'דפ״ר לצו ראשון'}
        titleColorClass="text-accent-tzav-rishon-fg"
      />

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setLanguage('he')}
          className={`py-2.5 rounded-lg font-semibold border transition ${
            language === 'he'
              ? 'bg-accent-tzav-rishon text-white border-accent-tzav-rishon'
              : 'bg-surface text-fg border-card-border hover:border-accent-tzav-rishon'
          }`}
        >
          עברית
        </button>
        <button
          onClick={() => setLanguage('ar')}
          className={`py-2.5 rounded-lg font-semibold border transition ${
            language === 'ar'
              ? 'bg-accent-tzav-rishon text-white border-accent-tzav-rishon'
              : 'bg-surface text-fg border-card-border hover:border-accent-tzav-rishon'
          }`}
        >
          العربية
        </button>
      </div>

      <CardGrid>
        {topics.map(t => (
          <Card
            key={t.key}
            icon="🎯"
            title={isAr ? t.labelAr : t.labelHe}
            subtitle={isAr ? `${t.count} سؤال` : `${t.count} שאלות`}
            accentColor="tzav-rishon"
            href={`/tzav-rishon/${t.key}`}
            onClick={() => router.push(`/tzav-rishon/${t.key}`)}
            trailing={<span className="text-accent-tzav-rishon-fg text-xl">←</span>}
          />
        ))}
      </CardGrid>
      </div>
    </div>
  )
}
