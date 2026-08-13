'use client'

import { Suspense, useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { t, debugMode } from '@/lib/dev-i18n'
import { getShowHint, subscribeShowHint } from '@/lib/dev-hint'

interface ServedQuestion {
  id: string
  topic: string
  difficulty: number
  prompt: string
  answer_kind: 'mcq' | 'text'
  options: string[] | null
  // Dev-only: present only when NEXT_PUBLIC_DEBUG_MODE is true at build
  // time (see the /next route). Used purely to render the optional QA hint
  // below — never used for grading, which always happens server-side via
  // /answer regardless.
  correct_answer?: string
}

interface AnswerResult {
  is_correct: boolean
  correct_answer: string
}

// Derived, not stored — same rationale as ticket 10's session page.
type Phase = 'intro' | 'loading' | 'question' | 'feedback' | 'done'

function PlacementRunner() {
  const router = useRouter()
  const sessionId = useSearchParams().get('session_id')

  const [phase, setPhase] = useState<Phase>('intro')
  const [question, setQuestion] = useState<ServedQuestion | null>(null)
  const [questionNumber, setQuestionNumber] = useState(0)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState('')
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const showHint = useSyncExternalStore(subscribeShowHint, getShowHint, getShowHint)

  useEffect(() => {
    if (!sessionId) router.replace('/naale')
  }, [sessionId, router])

  // Best-effort: a failed write here just means /session/start offers
  // placement again next time, which is safe — see the route's own comment.
  const finishPlacement = useCallback(async () => {
    if (!sessionId) return
    try {
      await fetch('/api/naale/placement/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
    } finally {
      setPhase('done')
    }
  }, [sessionId])

  const loadNext = useCallback(async () => {
    if (!sessionId) return
    setResult(null)
    setSelected('')
    setPhase('loading')
    try {
      const res = await fetch(`/api/naale/placement/next?session_id=${sessionId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      if (data.done) { finishPlacement(); return }
      setQuestion(data.question)
      setQuestionNumber(data.question_number)
      setTotal(data.total)
      setPhase('question')
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'שגיאה בטעינת השאלה')
    }
  }, [sessionId, finishPlacement])

  async function submitAnswer() {
    if (!question || submitting || selected === '') return
    setSubmitting(true)
    try {
      const res = await fetch('/api/naale/placement/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, question_id: question.id, answer: selected }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      setResult(data)
      setPhase('feedback')
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'שגיאה בשליחת התשובה')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen p-4 max-w-md mx-auto w-full flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-red-500 dark:text-red-400 text-sm">{loadError}</p>
        <button
          onClick={() => { setLoadError(''); loadNext() }}
          className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5"
        >
          {t('נסה שוב')}
        </button>
      </div>
    )
  }

  if (phase === 'intro') {
    return (
      <div className="min-h-screen p-4 max-w-md mx-auto w-full">
        <PageHeader backHref="/naale" title={t('שאלון קצר')} />
        <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 text-center">
          <div className="text-4xl mb-2">👋</div>
          <h2 className="text-lg font-bold text-fg mb-2">{t('כמה שאלות כדי שנדע מאיפה להתחיל')}</h2>
          <p className="text-fg/70 text-sm mb-6">
            {t('לפני שמתחילים לתרגל, נשאל אותך שאלה אחת בכל נושא. אין ציון ואין לחץ זמן — זה רק כדי להתאים את הרמה שלך.')}
          </p>
          <button
            onClick={loadNext}
            className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition"
          >
            {t('בואו נתחיל')}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'loading') return <LoadingSpinner />

  if (phase === 'done') {
    return (
      <div className="min-h-screen p-4 max-w-md mx-auto w-full">
        <PageHeader backHref="/naale" title={t('שאלון קצר')} />
        <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-lg font-bold text-fg mb-4">{t('מעולה! עכשיו נדע מאיפה להתחיל')}</h2>
          <button
            onClick={() => router.push('/naale')}
            className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition"
          >
            {t('לדף הבית')}
          </button>
        </div>
      </div>
    )
  }

  // phase is 'question' or 'feedback' from here — question is guaranteed non-null.
  const q = question!

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto w-full">
      <PageHeader backHref="/naale" title={t('שאלון קצר')} />

      {/* Unlike practice (ticket 10), placement has a real denominator — one
          question per topic, fixed — so n of total is meaningful here. */}
      <p className="text-xs text-fg/60 mb-4">
        {t('שאלה')} <LtrIsolate>{questionNumber}</LtrIsolate> {t('מתוך')} <LtrIsolate>{total}</LtrIsolate>
      </p>

      <p className="text-fg font-medium mb-4 text-right">{q.prompt}</p>

      {debugMode && showHint && q.answer_kind !== 'mcq' && q.correct_answer && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-4 text-right">
          💡 QA hint (dev-only, never shown in production): {q.correct_answer}
        </p>
      )}

      {q.answer_kind === 'mcq' && q.options ? (
        <div className="space-y-3 mb-4">
          {q.options.map(option => {
            const isSelected = selected === option
            const isTheCorrectOne = result?.correct_answer === option
            // Pre-answer, dev-only QA aid: colors just the option's text
            // green, using the field /next only ever includes in development.
            const isHintedCorrect = !result && debugMode && showHint && q.correct_answer === option

            let stateClass = 'bg-surface border-card-border hover:border-accent-naale text-fg'
            if (result) {
              if (isTheCorrectOne) stateClass = 'bg-green-50 border-green-400 text-green-800 dark:bg-green-950/40 dark:border-green-700 dark:text-green-300'
              else if (isSelected) stateClass = 'bg-red-50 border-red-400 text-red-800 dark:bg-red-950/40 dark:border-red-700 dark:text-red-300'
              else stateClass = 'bg-surface border-card-border text-fg/60'
            } else if (isSelected) {
              stateClass = 'bg-primary-50 dark:bg-primary-500/10 border-primary-400 text-fg'
            }

            return (
              <button
                key={option}
                onClick={() => !result && setSelected(option)}
                disabled={!!result || submitting}
                className={`w-full text-right rounded-xl border-2 p-4 transition flex items-center gap-3 disabled:cursor-default ${stateClass}`}
              >
                <span className={`flex-1 ${isHintedCorrect ? 'text-green-600 dark:text-green-400' : ''}`}>{option}</span>
                {result && isTheCorrectOne && (
                  <span className="text-green-700 dark:text-green-400 font-bold flex-shrink-0">✓<span className="sr-only">{t(' תשובה נכונה')}</span></span>
                )}
                {result && isSelected && !isTheCorrectOne && (
                  <span className="text-red-700 dark:text-red-400 font-bold flex-shrink-0">✗<span className="sr-only">{t(' בחרת בתשובה זו, שגויה')}</span></span>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="mb-4">
          <textarea
            value={selected}
            onChange={e => !result && setSelected(e.target.value)}
            disabled={!!result || submitting}
            placeholder={t('כתוב את תשובתך כאן...')}
            rows={5}
            className="w-full border border-card-border rounded-xl px-4 py-3 text-right resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 bg-surface text-fg disabled:opacity-70"
          />
          {result && (
            <p className={`mt-2 text-sm ${result.is_correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400 underline'}`}>
              {result.is_correct ? t('תשובה נכונה') : `${t('התשובה הנכונה')}: ${result.correct_answer}`}
            </p>
          )}
        </div>
      )}

      {!result ? (
        <button
          onClick={submitAnswer}
          disabled={submitting || selected === ''}
          className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {t('שלח תשובה')}
        </button>
      ) : (
        <button
          onClick={loadNext}
          className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition"
        >
          {t('השאלה הבאה')}
        </button>
      )}
    </div>
  )
}

export default function NaalePlacementPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PlacementRunner />
    </Suspense>
  )
}
