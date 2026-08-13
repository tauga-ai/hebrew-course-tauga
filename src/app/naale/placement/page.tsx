'use client'

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
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

  // Background-prefetch target for the next placement question — same
  // ref-based approach as session/page.tsx's prefetch (see that file's doc
  // comment): filled in only once THIS answer's result is known, and a ref
  // rather than state so loadNext()'s identity doesn't churn every question.
  const prefetchedQuestion = useRef<{ question: ServedQuestion; question_number: number; total: number } | null>(null)
  const prefetchedDone = useRef(false)

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

  // Pure fetch — no phase/state clearing, just resolves what the next
  // question is (or that placement is done). Extracted so the prefetch
  // effect below can call it without touching `question`/`phase` directly.
  const fetchNextQuestion = useCallback(async (): Promise<
    { question: ServedQuestion; question_number: number; total: number } | { done: true } | { error: string }
  > => {
    try {
      const res = await fetch(`/api/naale/placement/next?session_id=${sessionId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      if (data.done) return { done: true }
      return { question: data.question, question_number: data.question_number, total: data.total }
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'שגיאה בטעינת השאלה' }
    }
  }, [sessionId])

  // Advances to the next question — instantly, if the prefetch below
  // already resolved one; otherwise falls back to fetching on demand
  // (today's only path, complete with the loading phase).
  const loadNext = useCallback(async () => {
    if (!sessionId) return
    setResult(null)
    setSelected('')

    if (prefetchedQuestion.current) {
      const { question, question_number, total } = prefetchedQuestion.current
      prefetchedQuestion.current = null
      prefetchedDone.current = false
      setQuestion(question)
      setQuestionNumber(question_number)
      setTotal(total)
      setPhase('question')
      return
    }
    if (prefetchedDone.current) {
      prefetchedDone.current = false
      finishPlacement()
      return
    }

    setPhase('loading')
    const outcome = await fetchNextQuestion()
    if ('error' in outcome) { setLoadError(outcome.error); return }
    if ('done' in outcome) { finishPlacement(); return }
    setQuestion(outcome.question)
    setQuestionNumber(outcome.question_number)
    setTotal(outcome.total)
    setPhase('question')
  }, [sessionId, fetchNextQuestion, finishPlacement])

  // Kicks off the next question's fetch as soon as THIS answer's result is
  // known — see session/page.tsx's matching effect for why the timing here
  // (after grading, never before) matters. Deferred via setTimeout for the
  // same react-hooks/set-state-in-effect reason as that file (fetchNextQuestion
  // itself only sets loadError on failure, but calling it directly here still
  // trips the rule the same way).
  useEffect(() => {
    if (phase !== 'feedback') return
    let cancelled = false
    const id = setTimeout(() => {
      fetchNextQuestion().then(outcome => {
        if (cancelled) return
        if ('question' in outcome) prefetchedQuestion.current = outcome
        else if ('done' in outcome) prefetchedDone.current = true
        // 'error' outcome: left unset — loadNext()'s fallback fetch retries for real.
      })
    }, 0)
    return () => { cancelled = true; clearTimeout(id) }
  }, [phase, fetchNextQuestion])

  // Takes the answer explicitly rather than reading `selected` internally —
  // selectAndSubmit() below calls this in the same tick it sets `selected`,
  // before that state update has landed.
  async function submitAnswer(answer: string) {
    if (!question || submitting || answer === '') return
    setSubmitting(true)
    try {
      const res = await fetch('/api/naale/placement/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, question_id: question.id, answer }),
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

  // Auto-submits an MCQ option the instant it's clicked — no separate submit
  // button for multiple-choice (Quizlet-style).
  function selectAndSubmit(option: string) {
    setSelected(option)
    submitAnswer(option)
  }

  // Correct answers auto-advance after a beat; wrong answers wait for the
  // Continue button so there's time to read the correct answer. 700ms is a
  // feel judgment, matching session/page.tsx's — tune live, not exact here.
  useEffect(() => {
    if (phase === 'feedback' && result?.is_correct) {
      const id = setTimeout(() => { loadNext() }, 700)
      return () => clearTimeout(id)
    }
  }, [phase, result, loadNext])

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

      {/* justify-between: prompt (+ hint) at the top, choices (+ submit/
          continue) pushed down rather than immediately following the
          prompt text. */}
      {/* key={q.id} forces a remount (and replays the enter animation)
          every time the question changes. */}
      <div key={q.id} className="flex flex-col justify-between min-h-[70vh] animate-[question-enter_0.3s_ease-out]">
        <div>
          {/* Unlike practice (ticket 10), placement has a real denominator —
              one question per topic, fixed — so n of total is meaningful here. */}
          <p className="text-xs text-fg/60 mb-4">
            {t('שאלה')} <LtrIsolate>{questionNumber}</LtrIsolate> {t('מתוך')} <LtrIsolate>{total}</LtrIsolate>
          </p>

          <p className="text-fg font-medium mb-4 text-right">{q.prompt}</p>

          {debugMode && showHint && q.answer_kind !== 'mcq' && q.correct_answer && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-4 text-right">
              💡 QA hint (dev-only, never shown in production): {q.correct_answer}
            </p>
          )}
        </div>

        <div>
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
                } else if (submitting) {
                  // Grading request in flight: the clicked option stays
                  // highlighted, every other option visibly dims — not just
                  // functionally disabled, genuinely reads as inert.
                  stateClass = isSelected
                    ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-400 text-fg'
                    : 'bg-surface border-card-border text-fg/30 opacity-50'
                } else if (isSelected) {
                  stateClass = 'bg-primary-50 dark:bg-primary-500/10 border-primary-400 text-fg'
                }

                return (
                  <button
                    key={option}
                    // Auto-submits on click — no separate submit button for
                    // MCQ (Quizlet-style).
                    onClick={() => !result && !submitting && selectAndSubmit(option)}
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
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && !result && !submitting && selected !== '') {
                    e.preventDefault()
                    submitAnswer(selected)
                  }
                }}
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

          {!result && q.answer_kind !== 'mcq' && (
            <button
              onClick={() => submitAnswer(selected)}
              disabled={submitting || selected === ''}
              className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {t('שלח תשובה')}
            </button>
          )}

          {result && !result.is_correct && (
            <button
              onClick={() => loadNext()}
              className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition"
            >
              {t('המשך')}
            </button>
          )}
        </div>
      </div>
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
