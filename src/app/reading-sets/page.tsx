'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PracticeSet, Submission } from '@/lib/types'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import { CardGrid } from '@/components/ui/CardGrid'
import { Card } from '@/components/ui/Card'

export default function ReadingSetsPage() {
  const router = useRouter()
  const { session } = useStudentSession()
  const [sets, setSets] = useState<PracticeSet[]>([])
  const [completedSetIds, setCompletedSetIds] = useState<Set<number>>(new Set())
  const [submissions, setSubmissions] = useState<Record<number, Submission>>({})
  const [loading, setLoading] = useState(true)
  const [difficultyFilter, setDifficultyFilter] = useState<number | null>(null)

  useEffect(() => {
    if (!session) return

    async function load() {
      const [setsRes, subsRes] = await Promise.all([
        fetch('/api/practice-sets'),
        fetch(`/api/student/${session!.id}/submissions`),
      ])
      const setsData = await setsRes.json()
      const subsData = await subsRes.json()
      setSets(setsData.sets || [])

      const subMap: Record<number, Submission> = {}
      const doneIds = new Set<number>()
      for (const sub of subsData.submissions || []) {
        subMap[sub.practice_set_id] = sub
        doneIds.add(sub.practice_set_id)
      }
      setSubmissions(subMap)
      setCompletedSetIds(doneIds)
      setLoading(false)
    }
    load()
  }, [session])

  if (loading) return <LoadingSpinner />

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
