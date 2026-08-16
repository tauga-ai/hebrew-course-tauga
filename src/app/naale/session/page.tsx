'use client'

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { NaaleSidebar } from '@/components/naale/NaaleSidebar'
import { ConfettiBurst } from '@/components/naale/ConfettiBurst'
import { useCountdown, formatCountdown } from '@/lib/naale/use-countdown'
import { XP_PER_CORRECT, COINS_PER_CORRECT } from '@/lib/naale/rewards'
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
  // Ticket 15: true when this question came from /review-next rather than
  // /next — 2-3 hard exercises from the student's previous practice session,
  // re-served before new material. Purely a UI hint; the server independently
  // verifies review status when the answer is submitted.
  is_review?: boolean
}

interface AnswerResult {
  is_correct: boolean
  correct_answer: string
  explanation?: string
  level: number
  level_changed: boolean
}

interface EndSummary {
  answered_count: number
  completed: boolean
  min_answers: number
  xp_earned: number
  coins_earned: number
  streak: number
}

type DoneReason = 'time_up' | 'bank_exhausted' | 'no_topics'

// Upper bound on how long a correct answer's auto-advance will wait on a
// slow prefetch before giving up and advancing anyway (falling into
// loadNext()'s own loading-spinner fallback). Not a measured value — just
// comfortably above this environment's observed per-call latency (up to
// ~3.6s), so ordinary network variance never hits it in practice.
const SAFETY_CAP_MS = 5000

// Derived, not stored — 'done' whenever a doneReason exists, 'feedback' once
// an answer's result has come back, 'question' once a question has loaded,
// and 'loading' otherwise. Avoids a second source of truth alongside the
// state that already determines each of these.
type Phase = 'loading' | 'question' | 'feedback' | 'done'

// Dev-only console trace of the session flow — easier to follow along while
// QA-testing than reading Hebrew UI text. A no-op whenever
// NEXT_PUBLIC_DEBUG_MODE is off at build time, regardless of any client
// state.
function qaLog(label: string, data?: unknown) {
  if (!debugMode) return
  if (data === undefined) console.log(`[naale-qa] ${label}`)
  else console.log(`[naale-qa] ${label}`, data)
}

function SessionRunner() {
  const router = useRouter()
  const sessionId = useSearchParams().get('session_id')

  const [deadlineMs, setDeadlineMs] = useState<number | null>(null)
  // Ticket 15: only practice sessions review; placement never does. Read
  // once at boot from /status and never changes for the life of a session.
  const [kind, setKind] = useState<'placement' | 'practice' | null>(null)
  // Once /review-next reports nothing left, stop asking it every subsequent
  // "next question" click — a small optimization, not a correctness need
  // (it would just cheaply report done again).
  const [reviewExhausted, setReviewExhausted] = useState(false)
  const [question, setQuestion] = useState<ServedQuestion | null>(null)
  const [selected, setSelected] = useState<string>('')
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [doneReason, setDoneReason] = useState<DoneReason | null>(null)
  const [summary, setSummary] = useState<EndSummary | null>(null)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const showHint = useSyncExternalStore(subscribeShowHint, getShowHint, getShowHint)

  // Background-prefetch target for the NEXT question, filled in only once
  // THIS answer's result is known (never earlier — session/next's difficulty
  // pick depends on naale_topic_levels.level, which answering can just have
  // changed). Refs, not state: nothing needs to re-render off these, and a
  // ref sidesteps loadNext() picking up a new identity on every answer (a
  // state version here would re-trigger the boot effect below every
  // question, since it depends on loadNext).
  const prefetchedQuestion = useRef<ServedQuestion | null>(null)
  const prefetchedDone = useRef<{ reason: DoneReason } | null>(null)
  // Resolves once the prefetch above has landed in one of the two refs
  // above (or given up as an error) — lets the correct-answer auto-advance
  // effect below wait for the prefetch instead of firing on a blind timer,
  // so it never has to fall into loadNext()'s loading-spinner fallback in
  // the common case. Assigned synchronously in the prefetch effect (a plain
  // ref write, not a state update) even though what it resolves to is
  // produced by a deferred call — see that effect for why the call itself
  // has to be deferred.
  const prefetchPromise = useRef<Promise<void> | null>(null)

  const remaining = useCountdown(deadlineMs)

  // Closes the session out server-side (safe to call more than once — /end is
  // idempotent) and stores its verdict for the summary screen, so "completed"
  // always reflects the server's own computation rather than a client guess.
  // setDoneReason happens in the `finally`, after the await — never
  // synchronously in the caller's effect body, which this repo's stricter
  // react-hooks/set-state-in-effect lint rule disallows (see the matching
  // note in use-countdown.ts's Phase 1).
  const finishSession = useCallback(async (reason: DoneReason) => {
    if (!sessionId) return
    try {
      const res = await fetch('/api/naale/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      if (res.ok) {
        const data = await res.json()
        setSummary(data)
        qaLog(`session ended (${reason})`, data)
      }
    } catch {
      // Best-effort — the summary falls back to the locally-tracked counts.
    } finally {
      setDoneReason(reason)
    }
  }, [sessionId])

  // Pure fetch — no state clearing, just resolves what the next question (or
  // end reason) IS. Extracted from the old loadNext so the prefetch effect
  // below can call it without touching `question`/`result` directly (a
  // prefetch must never make the CURRENT question disappear from under the
  // student).
  //
  // kindOverride exists purely to dodge a stale-closure race on the very
  // first call out of boot(): setKind() and this call happen in the same
  // tick, so the `kind` state this callback closed over wouldn't be updated
  // yet on that first invocation. Every later call omits it and reads the
  // by-then-fresh `kind` state instead.
  const fetchNextQuestion = useCallback(async (
    kindOverride?: 'placement' | 'practice'
  ): Promise<{ question: ServedQuestion } | { done: true; reason: DoneReason } | { error: string }> => {
    try {
      const effectiveKind = kindOverride ?? kind
      const checkReview = !reviewExhausted && effectiveKind === 'practice'

      // Fired together, not sequentially: both are pure reads with no side
      // effects, so there's no correctness reason to only start /next after
      // review-next comes back. Paying for both round-trips back-to-back was
      // often enough on its own to blow past the 700ms auto-advance window —
      // see naale-stale-question-transition's addendum.
      const [reviewOutcome, nextOutcome] = await Promise.all([
        checkReview
          ? fetch(`/api/naale/session/review-next?session_id=${sessionId}`).then(async res => ({ res, data: await res.json() }))
          : null,
        fetch(`/api/naale/session/next?session_id=${sessionId}`).then(async res => ({ res, data: await res.json() })),
      ])

      if (reviewOutcome) {
        if (reviewOutcome.res.ok && !reviewOutcome.data.done) {
          qaLog('/review-next: question served', reviewOutcome.data.question)
          return { question: reviewOutcome.data.question }
        }
        // Nothing queued (or the request failed) — reviewExhausted still
        // flips exactly when review-next reports done, same as before.
        setReviewExhausted(true)
      }

      const { res, data } = nextOutcome
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      if (data.done) {
        qaLog(`/next: done (${data.reason})`)
        return { done: true, reason: data.reason as DoneReason }
      }
      qaLog('/next: question served', data.question)
      return { question: data.question }
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'שגיאה בטעינת השאלה' }
    }
  }, [sessionId, kind, reviewExhausted])

  // Advances to the next question — instantly, if the prefetch below already
  // resolved one; otherwise falls back to fetching on demand (today's only
  // path), so a slow/failed prefetch degrades to the old behavior rather
  // than hanging or erroring.
  const loadNext = useCallback(async (kindOverride?: 'placement' | 'practice') => {
    if (!sessionId) return
    setResult(null)
    setSelected('')

    if (prefetchedQuestion.current) {
      setQuestion(prefetchedQuestion.current)
      prefetchedQuestion.current = null
      prefetchedDone.current = null
      prefetchPromise.current = null
      return
    }
    if (prefetchedDone.current) {
      const { reason } = prefetchedDone.current
      prefetchedDone.current = null
      prefetchPromise.current = null
      finishSession(reason)
      setQuestion(null)
      return
    }

    // No prefetch ready yet — clear the stale (already-answered) question so
    // the derived `phase` shows 'loading' for this gap instead of re-rendering
    // the previous question as if it were fresh and clickable.
    setQuestion(null)
    const outcome = await fetchNextQuestion(kindOverride)
    if ('error' in outcome) { setLoadError(outcome.error); return }
    if ('done' in outcome) { finishSession(outcome.reason); setQuestion(null); return }
    setQuestion(outcome.question)
  }, [sessionId, fetchNextQuestion, finishSession])

  // Kicks off the NEXT question's fetch as soon as THIS answer's result is
  // known — not before (see the prefetchedQuestion/prefetchedDone doc
  // comment above for why timing matters here). Correct answers already
  // pause ~700ms for the reward flash before auto-advancing, and a wrong
  // answer's Continue click rarely beats this — so by the time loadNext()
  // actually runs, the result is usually already sitting in the ref.
  //
  // Deferred via setTimeout rather than called directly: fetchNextQuestion
  // can itself call setReviewExhausted, so this repo's
  // react-hooks/set-state-in-effect lint rule treats invoking it directly as
  // synchronous state-setting within the effect — same rationale as the
  // countdown-expiry effect above and DevPanel.tsx's refresh calls.
  useEffect(() => {
    if (!result) return
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout>
    // prefetchPromise.current is assigned HERE, synchronously, so the
    // correct-answer auto-advance effect (which runs right after this one,
    // same commit) can always read a live promise off the ref rather than
    // racing to see it before this effect has had a chance to set it. Only
    // the fetchNextQuestion() call itself is deferred (see below); wrapping
    // it in `new Promise` and writing the wrapper to the ref immediately is
    // a plain synchronous ref write, not a state update.
    prefetchPromise.current = new Promise<void>(resolve => {
      timeoutId = setTimeout(() => {
        fetchNextQuestion().then(outcome => {
          if (!cancelled) {
            if ('question' in outcome) prefetchedQuestion.current = outcome.question
            else if ('done' in outcome) prefetchedDone.current = { reason: outcome.reason }
            // 'error' outcome: left unset — loadNext()'s fallback fetch will
            // just retry for real and surface loadError normally if that
            // fails too.
          }
          resolve()
        })
      }, 0)
    })
    return () => { cancelled = true; clearTimeout(timeoutId) }
  }, [result, fetchNextQuestion])

  // Resume from the server's deadline — never a fresh 30 minutes on reload.
  useEffect(() => {
    if (!sessionId) { router.replace('/naale'); return }
    let cancelled = false
    async function boot() {
      const res = await fetch(`/api/naale/session/status?session_id=${sessionId}`)
      if (cancelled) return
      if (!res.ok) { router.replace('/naale'); return }
      const data = await res.json()
      if (cancelled) return
      qaLog('/status on boot', data)
      setAnsweredCount(data.answered_count)
      setDeadlineMs(new Date(data.deadline_at).getTime())
      setKind(data.kind)
      if (data.ended || data.expired) { finishSession('time_up'); return }
      loadNext(data.kind)
    }
    boot()
    return () => { cancelled = true }
    // finishSession is stable (only depends on sessionId, same as loadNext),
    // so this effect still only re-fires when sessionId itself changes.
  }, [sessionId, router, loadNext, finishSession])

  // The client clock is display-only; the server independently refuses late
  // answers (ticket 8) and stops serving questions (ticket 7). When it hits
  // zero we stop asking and close the session out ourselves too, so the
  // summary is ready without waiting on a stray answer/next call to 409/done.
  // Deferred via setTimeout rather than called directly: this repo's lint
  // rule treats a same-tick call to a state-setting function as "synchronous
  // within the effect" regardless of that function's own internal await —
  // a genuine callback (timer/promise) boundary is what it wants instead.
  useEffect(() => {
    if (remaining === 0 && doneReason === null) {
      qaLog('countdown reached zero — ending session')
      const id = setTimeout(() => finishSession('time_up'), 0)
      return () => clearTimeout(id)
    }
  }, [remaining, doneReason, finishSession])

  // Takes the answer explicitly rather than reading `selected` internally —
  // selectAndSubmit() below calls this in the same tick it sets `selected`,
  // before that state update has actually landed, so reading `selected` here
  // would see the PREVIOUS value, not the option just clicked.
  async function submitAnswer(answer: string) {
    if (!question || submitting || answer === '') return
    setSubmitting(true)
    try {
      const res = await fetch('/api/naale/session/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, question_id: question.id, answer }),
      })
      const data = await res.json()
      if (res.status === 409) {
        if (data.code === 'expired') {
          // The server's clock is authoritative — a real timeout ends the session.
          qaLog('/answer: 409 expired, ending session')
          finishSession('time_up')
          return
        }
        // A safely-rejected duplicate submission — the answer was already
        // recorded correctly the first time. Not a real problem: just move on.
        qaLog('/answer: 409 duplicate_answer, continuing to next question')
        loadNext()
        return
      }
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      qaLog('/answer: result', data)
      setResult(data)
      setAnsweredCount(c => c + 1)
      if (data.is_correct) setCorrectCount(c => c + 1)
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'שגיאה בשליחת התשובה')
    } finally {
      setSubmitting(false)
    }
  }

  // Auto-submits an MCQ option the instant it's clicked — no separate submit
  // button for multiple-choice, matching Quizlet's Learn-mode "tap an answer,
  // it's graded immediately" flow.
  function selectAndSubmit(option: string) {
    setSelected(option)
    submitAnswer(option)
  }

  // Correct answers auto-advance after the reward flash — no click needed.
  // Wrong answers deliberately do NOT auto-advance (the Continue button
  // below handles those) so the student has a moment to actually read the
  // correct answer before it's replaced. 700ms is a feel judgment, not a
  // measured value — tune it live against how the reward flash actually reads.
  //
  // Waits for the prefetch too, not just the 700ms flash: advancing on a
  // blind timer meant that whenever the prefetch hadn't resolved yet,
  // loadNext() would fall into its (correct, but visually jarring) loading
  // spinner right after the celebratory flash. Holding the flash open a
  // little longer instead — until the prefetch actually lands — means the
  // correct-answer path only ever shows the spinner in a genuinely
  // pathological case (the SAFETY_CAP_MS below), not on ordinary network
  // variance. A wrong answer's Continue click is unaffected: that's a
  // deliberate user-initiated pause already, not this fix's target.
  useEffect(() => {
    if (!result?.is_correct) return
    let cancelled = false
    let minDelayId: ReturnType<typeof setTimeout>
    let safetyId: ReturnType<typeof setTimeout>
    const minDelay = new Promise<void>(resolve => { minDelayId = setTimeout(resolve, 700) })
    const safetyCap = new Promise<void>(resolve => { safetyId = setTimeout(resolve, SAFETY_CAP_MS) })
    const prefetchReady = prefetchPromise.current ?? Promise.resolve()
    Promise.race([Promise.all([minDelay, prefetchReady]), safetyCap]).then(() => {
      if (!cancelled) loadNext()
    })
    return () => { cancelled = true; clearTimeout(minDelayId); clearTimeout(safetyId) }
  }, [result, loadNext])

  const phase: Phase = doneReason !== null ? 'done' : question === null ? 'loading' : result !== null ? 'feedback' : 'question'

  let content: ReactNode

  if (loadError) {
    content = (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-red-500 dark:text-red-400 text-sm">{loadError}</p>
        <button
          onClick={() => { setLoadError(''); loadNext() }}
          className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5"
        >
          {t('נסה שוב')}
        </button>
      </div>
    )
  } else if (phase === 'loading') {
    content = <LoadingSpinner />
  } else if (phase === 'done') {
    const shownAnswered = summary?.answered_count ?? answeredCount

    content = (
      <>
        <PageHeader backHref="/naale" title={t('תרגול')} />
        <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 text-center">
          {doneReason === 'no_topics' ? (
            <>
              <div className="text-4xl mb-2">⚠️</div>
              <h2 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4">
                {t('אין תרגילים זמינים כרגע. פנה/י למדריך/ה.')}
              </h2>
            </>
          ) : (
            <>
              <div className="text-4xl mb-2">{doneReason === 'bank_exhausted' ? '🎉' : '⏰'}</div>
              <h2 className="text-lg font-bold text-fg mb-1">
                {doneReason === 'bank_exhausted' ? t('כל הכבוד! סיימת את כל התרגילים להיום') : t('הזמן נגמר!')}
              </h2>
              <p className="text-fg/70 mb-2">
                {t('ענית על')} <LtrIsolate>{shownAnswered}</LtrIsolate> {t('תרגילים')}, <LtrIsolate>{correctCount}</LtrIsolate> {t('נכונות')}
              </p>
              {/* No total/percentage — the session ends on a clock, not on
                  finishing a fixed set, so there's no denominator to show. */}
              {summary && (
                <p className={`text-sm mb-4 ${summary.completed ? 'text-green-700 dark:text-green-400' : 'text-fg/60'}`}>
                  {summary.completed
                    ? t('התרגול נחשב כהושלם')
                    : `${t('התרגול לא נחשב כהושלם - נדרשות לפחות')} ${summary.min_answers} ${t('תשובות')}`}
                </p>
              )}
              {summary && (
                <div className="flex items-center justify-center gap-4 text-sm text-fg/70 mb-4">
                  <span>⭐ <LtrIsolate>{summary.xp_earned}</LtrIsolate> XP</span>
                  <span>🪙 <LtrIsolate>{summary.coins_earned}</LtrIsolate></span>
                  <span>🔥 <LtrIsolate>{summary.streak}</LtrIsolate> {t('שבועות ברצף')}</span>
                </div>
              )}
            </>
          )}
          <button
            onClick={() => router.push('/naale')}
            className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition"
          >
            {t('לדף הבית')}
          </button>
        </div>
      </>
    )
  } else {
    // phase is 'question' or 'feedback' here — question is guaranteed non-null.
    const q = question!

    content = (
      <>
        <PageHeader
          backHref="/naale"
          title={t('תרגול')}
          right={remaining !== null ? <LtrIsolate>{formatCountdown(remaining)}</LtrIsolate> : null}
        />

        {/* justify-between: prompt (+ review banner / reward flash / hint)
            at the top, choices (+ submit/continue) pushed down rather than
            immediately following the prompt text. */}
        {/* key={q.id} forces a remount (and replays the enter animation)
            every time the question changes — including auto-advance and
            Continue, not just the very first question. */}
        <div key={q.id} className="flex flex-col justify-between min-h-[70vh] animate-[question-enter_0.3s_ease-out]">
          <div>
            {/* Count, not a percentage bar — there is no total to divide by;
                the session ends on the clock, not on exhausting a fixed set. */}
            <p className="text-xs text-fg/60 mb-4">
              {t('תרגיל')} <LtrIsolate>{answeredCount + 1}</LtrIsolate>
            </p>

            {/* Ticket 15: visually distinguishes a re-served question from new
                material, and doubles as the "why am I seeing this again" intro the
                task calls for — shown on every review question rather than once,
                since that's simpler than tracking a one-shot "have I told them
                yet" flag and no less clear repeated. */}
            {q.is_review && (
              <p className="text-xs font-medium text-accent-naale mb-3 text-right">
                🔄 {t('חוזרים על שאלה מהתרגול הקודם')}
              </p>
            )}

            <p className="text-fg font-medium mb-4 text-right">{q.prompt}</p>

            {/* A confetti burst plus the reward note on a correct answer —
                relative positioning here is what anchors ConfettiBurst's
                absolutely-positioned pieces to this spot. A wrapping <div>,
                not <p>, since ConfettiBurst renders a block-level <div> and
                a <div> inside a <p> is invalid HTML (the browser would
                silently close the <p> early). */}
            {result?.is_correct && (
              <div className="relative mb-4">
                <ConfettiBurst />
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 text-right">
                  <LtrIsolate>{`+${XP_PER_CORRECT} XP · +${COINS_PER_CORRECT} 🪙`}</LtrIsolate>
                </p>
              </div>
            )}

            {debugMode && showHint && q.answer_kind !== 'mcq' && q.correct_answer && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-4 text-right">
                💡 QA hint (dev-only, never shown in production): {q.correct_answer}
              </p>
            )}
          </div>

          <div>
            {q.answer_kind === 'mcq' && q.options ? (
              // Always a single stacked column — never a 2-up grid, even on
              // wide screens (explicit request, reverses ticket 17's
              // responsive grid).
              <div className="space-y-3 mb-4">
                {q.options.map(option => {
                  const isSelected = selected === option
                  const isTheCorrectOne = result?.correct_answer === option
                  // Pre-answer, dev-only QA aid: colors just the option's text green,
                  // using the field /next only ever includes in development. Text
                  // only, no border/background, so it doesn't look like a real
                  // answered-state and can't be confused with the post-answer
                  // feedback below.
                  const isHintedCorrect = !result && debugMode && showHint && q.correct_answer === option

                  let stateClass = 'bg-surface border-card-border hover:border-accent-naale text-fg'
                  if (result) {
                    if (isTheCorrectOne) stateClass = 'bg-green-50 border-green-400 text-green-800 dark:bg-green-950/40 dark:border-green-700 dark:text-green-300'
                    else if (isSelected) stateClass = 'bg-red-50 border-red-400 text-red-800 dark:bg-red-950/40 dark:border-red-700 dark:text-red-300'
                    else stateClass = 'bg-surface border-card-border text-fg/60'
                  } else if (submitting) {
                    // Grading request in flight: the clicked option stays
                    // highlighted, every other option visibly dims — not
                    // just functionally disabled (the `disabled` prop below
                    // already blocked clicks on all of them), but genuinely
                    // reading as inert rather than looking identical to the
                    // untouched idle state.
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
                      // MCQ (Quizlet-style). `!submitting` guards the brief
                      // in-flight window, same as the `disabled` prop below.
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
                    // Enter submits (Shift+Enter still inserts a newline, the
                    // usual textarea convention) — free-text has no "click an
                    // option" gesture to auto-submit on, so this is its
                    // equivalent shortcut. The button below still works too.
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

            {/* Only shown on a wrong answer — a correct one needs no
                explaining. Present for both MCQ and free-text, since neither
                branch above surfaces it. A bordered, tinted callout (not a
                plain line of text) so it reads as its own "here's why" beat,
                distinct from the red/green correct-answer indicator above it
                — the Quizlet Learn-mode reference for this ticket. */}
            {result && !result.is_correct && result.explanation && (
              <div className="mt-3 mb-4 rounded-xl border-r-4 border-accent-naale bg-accent-naale/5 dark:bg-accent-naale/10 p-4 text-right">
                <p className="text-xs font-semibold text-accent-naale mb-1">
                  {t('הסבר')}
                </p>
                <p className="text-sm text-fg/80 leading-relaxed">
                  {result.explanation}
                </p>
              </div>
            )}

            {/* Free-text is the only branch that still needs an explicit
                submit — MCQ auto-submits on click above. */}
            {!result && q.answer_kind !== 'mcq' && (
              <button
                onClick={() => submitAnswer(selected)}
                disabled={submitting || selected === ''}
                className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                {t('שלח תשובה')}
              </button>
            )}

            {/* Correct answers auto-advance (see the setTimeout effect above)
                — only a wrong answer gets a button, so there's time to
                actually read the correct one before it's replaced. */}
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
      </>
    )
  }

  return (
    <div className="min-h-screen md:flex">
      <NaaleSidebar role="student" />
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">{content}</div>
    </div>
  )
}

export default function NaaleSessionPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SessionRunner />
    </Suspense>
  )
}
