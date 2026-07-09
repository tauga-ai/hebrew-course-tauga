'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Segments } from '@/components/makbatzim/Segments'
import { QuestionMap } from '@/components/makbatzim/QuestionMap'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import type { Segment } from '@/data/makbatzim/types'

interface QuestionOut {
  id: number
  question: Segment[]
  imageUrl?: string
  options: Segment[][]
}

interface ProgressEntry {
  question_id: number
  selected_option: number
  is_correct: boolean
  correct_option: number | null
  explanation: Segment[] | null
}

interface SetMeta {
  key: string
  labelHe: string
  count: number
}

export default function MakbatzimPracticePage() {
  const params = useParams()
  const setId = String(params.setId)
  const { session, loading: sessionLoading } = useStudentSession()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [seededForSet, setSeededForSet] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [retryToken, setRetryToken] = useState(0)
  // selectOption applies its result here immediately, ahead of the next
  // progress refetch (there isn't one — this page never refetches
  // progress after mount) — cleared whenever setId changes.
  const [optimisticProgress, setOptimisticProgress] = useState<Record<number, ProgressEntry>>({})
  const retry = `&_r=${retryToken}`

  const { data: qData, loading: qLoading, error: qError } = useResource<{ questions: QuestionOut[] }>(
    session ? `/api/makbatzim/questions?set_id=${setId}${retry}` : null
  )
  const { data: pData, loading: pLoading, error: pError } = useResource<{ progress: ProgressEntry[] }>(
    session ? `/api/makbatzim/progress?set_id=${setId}${retry}` : null
  )
  const { data: sData, loading: sLoading, error: sError } = useResource<{ sets: SetMeta[] }>(
    session ? `/api/makbatzim/sets?_r=${retryToken}` : null
  )

  const questions = qData?.questions ?? null
  const setMeta = sData?.sets.find(s => s.key === setId) ?? null
  const progress: Record<number, ProgressEntry> = {}
  for (const p of pData?.progress ?? []) progress[p.question_id] = p
  Object.assign(progress, optimisticProgress)

  const loadError = qError || pError || sError

  // Adjusting state when a prop changes (React's recommended pattern —
  // https://react.dev/learn/you-might-not-need-an-effect) rather than an
  // effect: optimistic overrides are specific to the set that was
  // answered, dropped when navigating to a different set; currentIndex is
  // seeded to the first unanswered question exactly once per set, as soon
  // as both questions and progress have finished loading (not on every
  // later progress update, e.g. right after answering, which would jump
  // the student back to an earlier question).
  if (Object.keys(optimisticProgress).length > 0 && seededForSet !== setId) {
    setOptimisticProgress({})
  }
  if (questions && pData && seededForSet !== setId) {
    const firstUnanswered = questions.findIndex(q => !(q.id in progress))
    setCurrentIndex(firstUnanswered === -1 ? 0 : firstUnanswered)
    setSeededForSet(setId)
  }

  if (loadError && questions === null) {
    return (
      <div className="min-h-screen md:flex">
        <StudentSidebar />
        <div className="flex-1 p-4 max-w-2xl mx-auto w-full flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-red-500 dark:text-red-400 text-sm">{loadError}</p>
          <button onClick={() => setRetryToken(t => t + 1)} className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5">נסה שוב</button>
        </div>
      </div>
    )
  }

  if (sessionLoading || qLoading || pLoading || sLoading || questions === null || setMeta === null || seededForSet !== setId) return <LoadingSpinner />

  const current = questions[currentIndex]
  const answered = progress[current.id]
  const total = questions.length
  const answeredCount = Object.keys(progress).length

  async function selectOption(optionNum: number) {
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/makbatzim/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_id: setId, question_id: current.id, selected_option: optionNum }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      setOptimisticProgress(prev => ({
        ...prev,
        [current.id]: {
          question_id: current.id,
          selected_option: optionNum,
          is_correct: data.is_correct,
          correct_option: data.correct_option,
          explanation: data.explanation,
        },
      }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בשליחה')
    } finally {
      setSubmitting(false)
    }
  }

  const resultsByQuestion = Object.fromEntries(
    Object.entries(progress).map(([qid, p]) => [qid, p.is_correct])
  )

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
      <PageHeader
        backHref="/makbatzim"
        title={setMeta.labelHe}
        right={<LtrIsolate>{`${answeredCount}/${total}`}</LtrIsolate>}
      />

      <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2 mb-4">
        <div
          className="bg-accent-makbatzim h-2 rounded-full transition-all"
          style={{ width: `${(answeredCount / total) * 100}%` }}
        />
      </div>

      <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 mb-4">
        <div className="text-xs text-fg/40 mb-3">
          שאלה <LtrIsolate>{`${currentIndex + 1} / ${total}`}</LtrIsolate>
        </div>
        {current.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- source image dimensions are unknown and hosting is cross-project (see plan); a plain <img> avoids committing to next/image config prematurely.
          <img src={current.imageUrl} alt="" className="w-full rounded-xl mb-4 border border-card-border" />
        )}
        <p className="text-fg leading-relaxed text-base">
          <Segments segments={current.question} />
        </p>
      </div>

      <div className="space-y-3 mb-4">
        {current.options.map((opt, i) => {
          const optionNum = i + 1
          const isSelected = answered?.selected_option === optionNum
          const isTheCorrectOne = answered && answered.correct_option === optionNum
          let stateClass = 'bg-surface border-card-border hover:border-accent-makbatzim text-fg'
          if (answered) {
            if (isTheCorrectOne) stateClass = 'bg-green-50 border-green-400 text-green-800 dark:bg-green-950/40 dark:border-green-700 dark:text-green-300'
            else if (isSelected) stateClass = 'bg-red-50 border-red-400 text-red-800 dark:bg-red-950/40 dark:border-red-700 dark:text-red-300'
            else stateClass = 'bg-surface border-card-border text-fg/60'
          }
          return (
            <button
              key={i}
              onClick={() => !answered && selectOption(optionNum)}
              disabled={!!answered || submitting}
              className={`w-full text-right rounded-xl border-2 p-4 transition flex items-center gap-3 disabled:cursor-default ${stateClass}`}
            >
              <span className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-black/5 dark:bg-white/10">
                {optionNum}
              </span>
              <span><Segments segments={opt} /></span>
            </button>
          )
        })}
      </div>

      {error && <p className="text-red-500 dark:text-red-400 text-sm text-center mb-4">{error}</p>}

      {answered && (
        <div className={`rounded-2xl p-4 mb-4 border ${answered.is_correct ? 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800'}`}>
          <div className={`font-bold mb-2 ${answered.is_correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {answered.is_correct ? 'תשובה נכונה!' : 'תשובה לא נכונה'}
          </div>
          {answered.explanation && (
            <div className="text-sm text-fg/80 leading-relaxed">
              <Segments segments={answered.explanation} />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5"
        >
          ← הקודמת
        </button>
        <button
          onClick={() => setCurrentIndex(i => Math.min(total - 1, i + 1))}
          disabled={currentIndex === total - 1}
          className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5"
        >
          הבאה →
        </button>
      </div>

      <QuestionMap count={total} currentIndex={currentIndex} results={resultsByQuestion} onJump={setCurrentIndex} />
      </div>
    </div>
  )
}
