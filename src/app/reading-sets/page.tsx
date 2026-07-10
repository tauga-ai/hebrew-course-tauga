'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PracticeSet, Submission } from '@/lib/types'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import { CardGrid } from '@/components/ui/CardGrid'
import { Card } from '@/components/ui/Card'

export default function ReadingSetsPage() {
  const router = useRouter()
  const { session } = useStudentSession()
  const [difficultyFilter, setDifficultyFilter] = useState<number | null>(null)

  const { data: setsData, loading: setsLoading } = useResource<{ sets: PracticeSet[] }>(
    session ? '/api/practice-sets' : null, { fallback: { sets: [] } }
  )
  const { data: subsData, loading: subsLoading } = useResource<{ submissions: Submission[] }>(
    session ? `/api/student/${session.id}/submissions` : null, { fallback: { submissions: [] } }
  )

  const sets = setsData?.sets ?? []
  const submissions: Record<number, Submission> = {}
  const completedSetIds = new Set<number>()
  for (const sub of subsData?.submissions ?? []) {
    submissions[sub.practice_set_id] = sub
    completedSetIds.add(sub.practice_set_id)
  }

  if (setsLoading || subsLoading) return <LoadingSpinner />

  const availableDifficulties = Array.from(new Set(sets.map(s => s.difficulty_level))).sort((a, b) => a - b)
  const filteredSets = difficultyFilter === null ? sets : sets.filter(s => s.difficulty_level === difficultyFilter)

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />
      <div className="flex-1 p-4 max-w-5xl mx-auto w-full">
      <PageHeader backHref="/menu" title="סטי הבנת הנקרא" right={session?.full_name} />

      {availableDifficulties.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            type="button"
            onClick={() => setDifficultyFilter(null)}
            className={`text-sm px-3 py-1.5 rounded-lg transition ${
              difficultyFilter === null ? 'bg-highlight text-white' : 'bg-surface border border-card-border text-fg/70'
            }`}
          >
            הכל
          </button>
          {availableDifficulties.map(level => (
            <button
              key={level}
              type="button"
              onClick={() => setDifficultyFilter(level)}
              className={`text-sm px-3 py-1.5 rounded-lg transition ${
                difficultyFilter === level ? 'bg-highlight text-white' : 'bg-surface border border-card-border text-fg/70'
              }`}
            >
              רמה {level}
            </button>
          ))}
        </div>
      )}

      <CardGrid>
        {filteredSets.map(set => {
          const done = completedSetIds.has(set.id)
          const sub = submissions[set.id]
          return (
            <Card
              key={set.id}
              icon="📖"
              title={`סט ${set.set_number}`}
              subtitle={`${set.topic}, רמה ${set.difficulty_level}`}
              accentColor="reading"
              disabled={done}
              href={`/practice/${set.id}`}
              onClick={() => router.push(`/practice/${set.id}`)}
              trailing={
                done ? (
                  <span className="flex flex-col items-end">
                    <span className="text-success-600 font-bold text-sm">{Math.round(sub.score_percentage)}%</span>
                    <span className="text-xs text-success-600/70">הושלם</span>
                  </span>
                ) : (
                  <span className="text-primary-500 text-sm">←</span>
                )
              }
            />
          )
        })}
      </CardGrid>
      </div>
    </div>
  )
}
