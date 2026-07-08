'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PracticeSet, Submission } from '@/lib/types'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import { CardGrid } from '@/components/ui/CardGrid'
import { Card } from '@/components/ui/Card'

export default function Menu() {
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

  function handleLogout() {
    localStorage.removeItem('student_session')
    router.replace('/student')
  }

  if (loading) return <LoadingSpinner />

  const availableDifficulties = Array.from(new Set(sets.map(s => s.difficulty_level))).sort((a, b) => a - b)
  const filteredSets = difficultyFilter === null ? sets : sets.filter(s => s.difficulty_level === difficultyFilter)

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar
        difficultyFilter={difficultyFilter}
        onDifficultyFilterChange={setDifficultyFilter}
        availableDifficulties={availableDifficulties}
      />

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
            title="סימולציה אמיתית"
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
