'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStudentSession } from '@/lib/hooks/use-student-session'
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
  const [sets, setSets] = useState<SetMeta[] | null>(null)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetch('/api/makbatzim/sets')
      .then(r => r.json())
      .then(data => { if (!cancelled) setSets(data.sets || []) })
      .catch(() => { if (!cancelled) setSets([]) })
    return () => { cancelled = true }
  }, [session])

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
            onClick={() => router.push(`/makbatzim/${s.key}`)}
            trailing={<span className="text-accent-makbatzim text-xl">←</span>}
          />
        ))}
      </CardGrid>
      </div>
    </div>
  )
}
