'use client'

import { useRouter } from 'next/navigation'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import { CardGrid } from '@/components/ui/CardGrid'
import { Card } from '@/components/ui/Card'

interface SetMeta {
  key: string
  labelHe: string
  count: number
}

export default function MakbatzimSetsPage() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useStudentSession()
  const { data } = useResource<{ sets: SetMeta[] }>(session ? '/api/makbatzim/sets' : null, { fallback: { sets: [] } })
  // 'dapar-simulation' moved to its own top-level card in the lobby — still a
  // real set (grading/questions API unaffected), just no longer listed here.
  const sets = data ? data.sets.filter(s => s.key !== 'dapar-simulation') : null

  if (sessionLoading || sets === null) return <LoadingSpinner />

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />
      <div className="flex-1 p-4 max-w-md mx-auto w-full">
      <PageHeader backHref="/menu" title="שאלות שעדי שלחה" />

      <CardGrid>
        {sets.map(s => (
          <Card
            key={s.key}
            icon="🧮"
            title={s.labelHe}
            subtitle={`${s.count} שאלות`}
            accentColor="makbatzim"
            href={`/makbatzim/${s.key}`}
            onClick={() => router.push(`/makbatzim/${s.key}`)}
            trailing={<span className="text-fg/40 text-xl">←</span>}
          />
        ))}
      </CardGrid>
      </div>
    </div>
  )
}
