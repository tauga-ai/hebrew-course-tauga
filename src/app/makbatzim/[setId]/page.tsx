'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useQuizEngine } from '@/lib/hooks/use-quiz-engine'
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

interface SetMeta {
  key: string
  labelHe: string
  count: number
}

export default function MakbatzimPracticePage() {
  const params = useParams()
  const setId = String(params.setId)
  const { session, loading: sessionLoading } = useStudentSession()
  const [brokenImageId, setBrokenImageId] = useState<number | null>(null)

  const engine = useQuizEngine<QuestionOut, SetMeta, Segment[]>({
    entityId: setId,
    session,
    questionsUrl: `/api/makbatzim/questions?set_id=${setId}`,
    progressUrl: `/api/makbatzim/progress?set_id=${setId}`,
    entityMetaUrl: '/api/makbatzim/sets',
    entityMetaKey: 'sets',
    submitUrl: '/api/makbatzim/submit',
    submitBodyExtra: { set_id: setId },
    submitErrorMessage: 'שגיאה בשליחה',
    deferFeedback: setId === 'dapar-simulation',
  })

  if (engine.loadError && engine.questions === null) {
    return (
      <div className="min-h-screen md:flex">
        <StudentSidebar />
        <div className="flex-1 p-4 max-w-2xl mx-auto w-full flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-red-500 dark:text-red-400 text-sm">{engine.loadError}</p>
          <button onClick={engine.retryLoad} className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5">נסה שוב</button>
        </div>
      </div>
    )
  }

  if (sessionLoading || engine.loading || !engine.current || !engine.entityMeta) return <LoadingSpinner />

  const { current, answered, total, currentIndex, answeredCount, submitting, error, resultsByQuestion, revealed, entityMeta: setMeta } = engine

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
      <PageHeader
        backHref={setId === 'dapar-simulation' ? '/menu' : '/makbatzim'}
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
          brokenImageId === current.id ? (
            <div className="w-full rounded-xl mb-4 border border-card-border bg-black/5 dark:bg-white/5 p-6 text-center text-sm text-fg/40">
              🖼️ התמונה לא נטענה
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- source image dimensions are unknown and hosting is cross-project (see plan); a plain <img> avoids committing to next/image config prematurely.
            <img
              src={current.imageUrl}
              alt=""
              className="w-full rounded-xl mb-4 border border-card-border"
              onError={() => {
                console.error(`Failed to load makbatzim question image: ${current.imageUrl}`)
                setBrokenImageId(current.id)
              }}
            />
          )
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
          if (answered && revealed) {
            if (isTheCorrectOne) stateClass = 'bg-green-50 border-green-400 text-green-800 dark:bg-green-950/40 dark:border-green-700 dark:text-green-300'
            else if (isSelected) stateClass = 'bg-red-50 border-red-400 text-red-800 dark:bg-red-950/40 dark:border-red-700 dark:text-red-300'
            else stateClass = 'bg-surface border-card-border text-fg/60'
          } else if (answered && isSelected) {
            // Exam mode, not yet revealed — acknowledge the selection without
            // showing whether it's right, same neutral treatment as the
            // non-revealing reading phase in the main Hebrew simulation.
            stateClass = 'bg-primary-50 dark:bg-primary-500/10 border-primary-400 text-fg'
          }
          return (
            <button
              key={i}
              onClick={() => !answered && engine.selectOption(optionNum)}
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

      {answered && revealed && (
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
          onClick={engine.goPrev}
          disabled={currentIndex === 0}
          className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5"
        >
          ← הקודמת
        </button>
        <button
          onClick={engine.goNext}
          disabled={currentIndex === total - 1}
          className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5"
        >
          הבאה →
        </button>
      </div>

      <QuestionMap
        count={total}
        currentIndex={currentIndex}
        results={revealed ? resultsByQuestion : Object.fromEntries(Object.keys(resultsByQuestion).map(qid => [qid, 'answered' as const]))}
        onJump={engine.jumpTo}
      />
      </div>
    </div>
  )
}
