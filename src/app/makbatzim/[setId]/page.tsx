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
import { t } from '@/lib/dev-i18n'
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

  // Summary/retry are local, entity-scoped UI state — reset whenever the
  // student navigates to a different set. Retry answers are graded against
  // the already-revealed correct_option sitting in engine progress; they are
  // never sent to the submit endpoint, so a retry attempt never overwrites
  // the historical result of the student's first attempt.
  const [viewMode, setViewMode] = useState<'quiz' | 'summary' | 'retry'>('quiz')
  const [summaryShownForEntity, setSummaryShownForEntity] = useState<string | null>(null)
  const [retryQueue, setRetryQueue] = useState<QuestionOut[]>([])
  const [retryIndex, setRetryIndex] = useState(0)
  const [retryAnswer, setRetryAnswer] = useState<number | null>(null)
  const [resetForEntity, setResetForEntity] = useState<string | null>(null)

  // Render-time reset (React's recommended pattern, mirroring
  // use-quiz-engine's own entity-change handling) rather than an effect —
  // these are local view states, not data to synchronize with an external
  // system, so there's nothing to "effect" here.
  if (resetForEntity !== setId) {
    setViewMode('quiz')
    setSummaryShownForEntity(null)
    setRetryQueue([])
    setRetryIndex(0)
    setRetryAnswer(null)
    setResetForEntity(setId)
  }

  const engine = useQuizEngine<QuestionOut, SetMeta, Segment[]>({
    entityId: setId,
    session,
    questionsUrl: `/api/makbatzim/questions?set_id=${setId}`,
    progressUrl: `/api/makbatzim/progress?set_id=${setId}`,
    entityMetaUrl: '/api/makbatzim/sets',
    entityMetaKey: 'sets',
    submitUrl: '/api/makbatzim/submit',
    submitBodyExtra: { set_id: setId },
    submitErrorMessage: t('שגיאה בשליחה'),
    deferFeedback: setId === 'dapar-simulation',
  })

  if (engine.loadError && engine.questions === null) {
    return (
      <div className="min-h-screen md:flex">
        <StudentSidebar />
        <div className="flex-1 p-4 max-w-2xl mx-auto w-full flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-red-500 dark:text-red-400 text-sm">{engine.loadError}</p>
          <button onClick={engine.retryLoad} className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5">{t('נסה שוב')}</button>
        </div>
      </div>
    )
  }

  if (sessionLoading || engine.loading || !engine.current || !engine.entityMeta) return <LoadingSpinner />

  const { current, answered, total, currentIndex, answeredCount, submitting, error, resultsByQuestion, revealed, questions, progress, entityMeta: setMeta } = engine

  const isComplete = total > 0 && answeredCount === total && revealed
  const correctCount = questions?.filter(q => progress[q.id]?.is_correct).length ?? 0
  const missedQuestions = isComplete && questions ? questions.filter(q => progress[q.id] && !progress[q.id].is_correct) : []

  // Auto-surface the summary exactly once per entity, right as the set
  // completes — this is also the moment dapar-simulation's deferred
  // feedback reveals, replacing what used to be a silent in-place reveal
  // with an actual "you're done" screen.
  if (isComplete && summaryShownForEntity !== setId && viewMode === 'quiz') {
    setViewMode('summary')
    setSummaryShownForEntity(setId)
  }

  function startRetry() {
    setRetryQueue(missedQuestions)
    setRetryIndex(0)
    setRetryAnswer(null)
    setViewMode('retry')
  }

  if (viewMode === 'summary') {
    return (
      <div className="min-h-screen md:flex">
        <StudentSidebar />
        <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
          <PageHeader
            backHref={setId === 'dapar-simulation' ? '/menu' : '/makbatzim'}
            title={setMeta.labelHe}
          />
          <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 text-center">
            <div className="text-4xl mb-2">{missedQuestions.length === 0 ? '🎉' : '✅'}</div>
            <h2 className="text-lg font-bold text-fg mb-1">{t('סיימת את הסט!')}</h2>
            <p className="text-fg/70 mb-4">
              <LtrIsolate>{`${correctCount}/${total}`}</LtrIsolate> {t('תשובות נכונות')}
            </p>
            {missedQuestions.length === 0 ? (
              <p className="text-green-600 dark:text-green-400 font-semibold mb-4">{t('כל הכבוד, ענית נכון על כל השאלות!')}</p>
            ) : (
              <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 mb-4 text-right">
                <p className="text-sm text-fg/60 mb-2">{t('שאלות שטעית בהן:')}</p>
                <div className="flex flex-wrap gap-2">
                  {missedQuestions.map(q => (
                    <span key={q.id} className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center">
                      {q.id}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {missedQuestions.length > 0 && (
                <button
                  onClick={startRetry}
                  className="w-full py-3 rounded-xl bg-accent-makbatzim text-white font-semibold hover:opacity-90 transition"
                >
                  {t('תרגל שוב את הטעויות')} ({missedQuestions.length})
                </button>
              )}
              <button
                onClick={() => setViewMode('quiz')}
                className="w-full py-3 rounded-xl border border-card-border text-fg/70 hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                {t('סקור את כל השאלות')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (viewMode === 'retry') {
    const retryDone = retryIndex >= retryQueue.length
    const retryQ = !retryDone ? retryQueue[retryIndex] : null
    const originalProgress = retryQ ? progress[retryQ.id] : null

    return (
      <div className="min-h-screen md:flex">
        <StudentSidebar />
        <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
          <PageHeader
            backHref={setId === 'dapar-simulation' ? '/menu' : '/makbatzim'}
            title={t('תרגול טעויות')}
            right={!retryDone ? <LtrIsolate>{`${retryIndex + 1}/${retryQueue.length}`}</LtrIsolate> : undefined}
          />

          {retryDone ? (
            <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 text-center">
              <div className="text-4xl mb-2">💪</div>
              <h2 className="text-lg font-bold text-fg mb-4">{t('סיימת לתרגל את הטעויות!')}</h2>
              <button
                onClick={() => setViewMode('summary')}
                className="w-full py-3 rounded-xl bg-accent-makbatzim text-white font-semibold hover:opacity-90 transition"
              >
                {t('חזרה לסיכום')}
              </button>
            </div>
          ) : retryQ && originalProgress ? (
            <>
              <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 mb-4">
                {retryQ.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- same rationale as the quiz view above.
                  <img
                    src={retryQ.imageUrl}
                    alt={t('תמונה מצורפת לשאלה')}
                    className="w-full rounded-xl mb-4 border border-card-border"
                  />
                )}
                <p className="text-fg leading-relaxed text-base">
                  <Segments segments={retryQ.question} />
                </p>
              </div>

              <div className="space-y-3 mb-4">
                {retryQ.options.map((opt, i) => {
                  const optionNum = i + 1
                  const isSelected = retryAnswer === optionNum
                  const isTheCorrectOne = originalProgress.correct_option === optionNum
                  let stateClass = 'bg-surface border-card-border hover:border-accent-makbatzim text-fg'
                  if (retryAnswer !== null) {
                    if (isTheCorrectOne) stateClass = 'bg-green-50 border-green-400 text-green-800 dark:bg-green-950/40 dark:border-green-700 dark:text-green-300'
                    else if (isSelected) stateClass = 'bg-red-50 border-red-400 text-red-800 dark:bg-red-950/40 dark:border-red-700 dark:text-red-300'
                    else stateClass = 'bg-surface border-card-border text-fg/60'
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => retryAnswer === null && setRetryAnswer(optionNum)}
                      disabled={retryAnswer !== null}
                      className={`w-full text-right rounded-xl border-2 p-4 transition flex items-center gap-3 disabled:cursor-default ${stateClass}`}
                    >
                      <span className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-black/5 dark:bg-white/10">
                        {optionNum}
                      </span>
                      <span className="flex-1"><Segments segments={opt} /></span>
                      {retryAnswer !== null && isTheCorrectOne && (
                        <span className="text-green-700 dark:text-green-400 font-bold flex-shrink-0">✓<span className="sr-only">{t(' תשובה נכונה')}</span></span>
                      )}
                      {retryAnswer !== null && isSelected && !isTheCorrectOne && (
                        <span className="text-red-700 dark:text-red-400 font-bold flex-shrink-0">✗<span className="sr-only">{t(' בחרת בתשובה זו, שגויה')}</span></span>
                      )}
                    </button>
                  )
                })}
              </div>

              {retryAnswer !== null && originalProgress.explanation && (
                <div className="rounded-2xl p-4 mb-4 border bg-black/5 dark:bg-white/5">
                  <div className="text-sm text-fg/80 leading-relaxed">
                    <Segments segments={originalProgress.explanation} />
                  </div>
                </div>
              )}

              <button
                onClick={() => { setRetryIndex(i => i + 1); setRetryAnswer(null) }}
                disabled={retryAnswer === null}
                className="w-full py-3 rounded-xl bg-accent-makbatzim text-white font-semibold hover:opacity-90 transition disabled:opacity-40"
              >
                {retryIndex === retryQueue.length - 1 ? t('סיום') : t('הבאה →')}
              </button>
            </>
          ) : null}
        </div>
      </div>
    )
  }

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
          {t('שאלה')} <LtrIsolate>{`${currentIndex + 1} / ${total}`}</LtrIsolate>
        </div>
        {current.imageUrl && (
          brokenImageId === current.id ? (
            <div className="w-full rounded-xl mb-4 border border-card-border bg-black/5 dark:bg-white/5 p-6 text-center text-sm text-fg/40">
              {t('🖼️ התמונה לא נטענה')}
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- source image dimensions are unknown and hosting is cross-project (see plan); a plain <img> avoids committing to next/image config prematurely.
            <img
              src={current.imageUrl}
              alt={t('תמונה מצורפת לשאלה')}
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
              // Exam mode (dapar-simulation, deferFeedback): the answer isn't
              // locked until the whole set is revealed, so a student can
              // change their mind — including navigating back to an earlier
              // question via QuestionMap — right up until question 40 is
              // answered. Every other set has revealed === true from the
              // start, so this is unchanged there: locked the instant it's
              // answered, same as before.
              onClick={() => (!answered || !revealed) && engine.selectOption(optionNum)}
              disabled={(!!answered && revealed) || submitting}
              className={`w-full text-right rounded-xl border-2 p-4 transition flex items-center gap-3 disabled:cursor-default ${stateClass}`}
            >
              <span className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-black/5 dark:bg-white/10">
                {optionNum}
              </span>
              <span className="flex-1"><Segments segments={opt} /></span>
              {answered && revealed && isTheCorrectOne && (
                <span className="text-green-700 dark:text-green-400 font-bold flex-shrink-0">✓<span className="sr-only">{t(' תשובה נכונה')}</span></span>
              )}
              {answered && revealed && isSelected && !isTheCorrectOne && (
                <span className="text-red-700 dark:text-red-400 font-bold flex-shrink-0">✗<span className="sr-only">{t(' בחרת בתשובה זו, שגויה')}</span></span>
              )}
            </button>
          )
        })}
      </div>

      {error && <p className="text-red-500 dark:text-red-400 text-sm text-center mb-4">{error}</p>}

      {answered && revealed && (
        <div className={`rounded-2xl p-4 mb-4 border ${answered.is_correct ? 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800'}`}>
          <div className={`font-bold mb-2 ${answered.is_correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {answered.is_correct ? t('תשובה נכונה!') : t('תשובה לא נכונה')}
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
          {t('← הקודמת')}
        </button>
        <button
          onClick={engine.goNext}
          disabled={currentIndex === total - 1}
          className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5"
        >
          {t('הבאה →')}
        </button>
      </div>

      <QuestionMap
        count={total}
        currentIndex={currentIndex}
        results={revealed ? resultsByQuestion : Object.fromEntries(Object.keys(resultsByQuestion).map(qid => [qid, 'answered' as const]))}
        onJump={engine.jumpTo}
      />

      {isComplete && (
        <button
          onClick={() => setViewMode('summary')}
          className="w-full mt-4 py-3 rounded-xl border border-card-border text-fg/70 hover:bg-black/5 dark:hover:bg-white/5 transition"
        >
          {t('חזרה לסיכום')}
        </button>
      )}
      </div>
    </div>
  )
}
