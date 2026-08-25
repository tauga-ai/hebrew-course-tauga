'use client'

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { NaaleSidebar } from '@/components/naale/NaaleSidebar'
import { ConfettiBurst } from '@/components/naale/ConfettiBurst'
import { ReportQuestionModal } from '@/components/naale/ReportQuestionModal'
import { useCountdown, formatCountdown } from '@/lib/naale/use-countdown'
import { XP_PER_CORRECT, COINS_PER_CORRECT, COIN_SCORE_THRESHOLD, gradedAnswerReward } from '@/lib/naale/rewards'
import { t, debugMode, getDevLang } from '@/lib/dev-i18n'
import { scoreColor } from '@/lib/score-color'
import { getShowHint, subscribeShowHint } from '@/lib/dev-hint'
import { getShowQuestionBadge, subscribeShowQuestionBadge } from '@/lib/dev-question-badge'
import { getSessionMinutesOverride, subscribeSessionMinutesOverride } from '@/lib/naale/dev-fast-session'
import { useHoldToTranslate } from '@/lib/naale/use-hold-to-translate'
import { canGoBack, goBack, goForward, isResolved } from '@/lib/naale/session-history'
import type { SessionSummary } from '@/lib/naale/session-summary'
import { OpenAnswerInput } from '@/components/naale/OpenAnswerInput'
import { OPEN_EXERCISE_DISPLAY } from '@/lib/naale/open-exercise-display'
import type { NaaleTopicStat } from '@/lib/naale/stats'

interface ServedQuestion {
  id: string
  topic: string
  difficulty: number
  // Which content table this came from — naale_questions (mcq) or
  // naale_open_questions (open, AI-graded free text), matching /next's own
  // PublicQuestion discriminant.
  kind: 'mcq' | 'open'
  prompt: string
  // 'mcq' only:
  answer_kind?: 'mcq' | 'text'
  options?: string[] | null
  // Dev-only: present only when NEXT_PUBLIC_DEBUG_MODE is true at build
  // time (see the /next route). Used purely to render the optional QA hint
  // below — never used for grading, which always happens server-side via
  // /answer regardless.
  correct_answer?: string
  // 'open' only — already stripped of grading-only keys by the server (see
  // open-grading.ts's publicFields()).
  fields?: Record<string, string>
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
  // The server's word on whether this counted, not the question's UI hint —
  // a review answer earns no XP or coins (every reward path filters
  // is_review = false), so the reward note must not claim otherwise.
  is_review: boolean
}

interface OpenAnswerResult {
  score: number
  feedback: string
  level: number
  level_changed: boolean
  milestone: number | null
  /** See AnswerResult.is_review — same rule for graded answers. */
  is_review: boolean
}

interface EndSummary {
  answered_count: number
  correct_count: number
  completed: boolean
  reached_timer: boolean
  min_answers: number
  xp_earned: number
  coins_earned: number
  streak: number
  topics: NaaleTopicStat[]
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
/** One already-answered question, kept client-side so the student can look
 *  back at it. Nothing here is stored server-side: the resolved state is
 *  already in memory, and a reload legitimately loses the trail (the timer and
 *  progress survive, because those ARE server-side). */
interface HistoryEntry {
  question: ServedQuestion
  selected: string
  result: AnswerResult | null
  openAnswerText: string
  openResult: OpenAnswerResult | null
}

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

// Same tiers as score-color.ts's default palette (70/50), as a background
// fill rather than text — the session-end topic rows color-code the
// accuracy bar itself, which the general stats page's always-teal bar
// doesn't do.
function accuracyBarColor(pct: number | null) {
  if (pct === null) return 'bg-fg/15'
  if (pct >= 70) return 'bg-green-600 dark:bg-green-400'
  if (pct >= 50) return 'bg-yellow-600 dark:bg-yellow-400'
  return 'bg-red-500 dark:bg-red-400'
}

function SessionRunner() {
  const router = useRouter()
  const sessionId = useSearchParams().get('session_id')
  const [translationLang, setTranslationLang] = useState<'ru' | 'ar'>('ru')
  const { renderText, consumeJustTranslated, popoverElement, hintElement, debugUsage: debugTranslations } = useHoldToTranslate(sessionId, translationLang)

  const [deadlineMs, setDeadlineMs] = useState<number | null>(null)
  // Ticket 15: only practice sessions review; placement never does. Read
  // once at boot from /status and never changes for the life of a session.
  const [kind, setKind] = useState<'placement' | 'practice' | null>(null)
  // Once /review-next reports nothing left, stop asking it every subsequent
  // "next question" click — a small optimization, not a correctness need
  // (it would just cheaply report done again).
  const [reviewExhausted, setReviewExhausted] = useState(false)
  // Noam's AI end-of-session note. Deliberately SEPARATE state from
  // `summary` — it arrives from its own route after the recap has already
  // painted, so a slow or failed note can never delay or blank the numbers
  // session/end already returned.
  const [summaryNote, setSummaryNote] = useState<SessionSummary | null>(null)
  const [noteLoading, setNoteLoading] = useState(false)
  const [question, setQuestion] = useState<ServedQuestion | null>(null)
  const [selected, setSelected] = useState<string>('')
  const [result, setResult] = useState<AnswerResult | null>(null)
  // 'open' (AI-graded) questions use their own text/result state rather than
  // selected/result — a free-text continuation isn't a single selectable
  // value, and its result is a 1-5 score, not a boolean is_correct.
  const [openAnswerText, setOpenAnswerText] = useState('')
  const [openResult, setOpenResult] = useState<OpenAnswerResult | null>(null)
  const [openValidationError, setOpenValidationError] = useState('')
  // Same score-card pattern as sentence practice's THRESHOLDS/scoreLabel
  // (src/app/sentence/[setId]/page.tsx) — 4-5 is "advance", 3 is "neutral"
  // per the AI-graded leveling rule (naale-story-continuation/task.md).
  const OPEN_SCORE_THRESHOLDS = { good: 4, ok: 3 }
  const openScoreTextColor = (s: number) => scoreColor(s, { thresholds: OPEN_SCORE_THRESHOLDS })
  const openScoreBg = (s: number) => scoreColor(s, {
    thresholds: OPEN_SCORE_THRESHOLDS,
    palette: {
      good: 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800',
      ok: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-800',
      bad: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800',
    },
  })
  const openScoreLabel = (s: number) => s >= 5 ? t('מצוין!') : s >= 4 ? t('טוב מאוד') : s >= 3 ? t('סביר') : t('צריך שיפור')
  // Answered questions, oldest first. viewIndex === null means "looking at the
  // live question"; any number is a position in `history`.
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  // N4: which question the report modal is open for, or null. Holds the id
  // rather than a boolean so the modal reports the question that was on
  // screen when it opened, even if the session moves on underneath it.
  const [reportingQuestionId, setReportingQuestionId] = useState<string | null>(null)
  // Written every render rather than threaded through loadNext's dependencies:
  // loadNext deliberately does NOT depend on per-answer state (see the ref
  // comment above it), and adding these would give it a new identity on every
  // answer — the exact churn that caused the double-boot bug in PR #54.
  const currentSnapshot = useRef<HistoryEntry | null>(null)

  const [doneReason, setDoneReason] = useState<DoneReason | null>(null)
  const [summary, setSummary] = useState<EndSummary | null>(null)
  // The done screen is a 2-step recap when there's a per-topic breakdown to
  // show (step 0: the celebratory/rewards moment — and eventually the AI
  // feedback note, item 9, not built yet; step 1: "By topic" at full size,
  // rather than the two competing for space on one long page). Collapses to
  // a single step with no dots/Next when there's nothing to put on step 1.
  const [resultStep, setResultStep] = useState<0 | 1>(0)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const showHint = useSyncExternalStore(subscribeShowHint, getShowHint, getShowHint)
  const showQuestionBadge = useSyncExternalStore(subscribeShowQuestionBadge, getShowQuestionBadge, getShowQuestionBadge)
  const sessionMinutesOverride = useSyncExternalStore(
    subscribeSessionMinutesOverride,
    getSessionMinutesOverride,
    getSessionMinutesOverride
  )

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

        // Deferred on purpose: blocking session/end on Gemini would put up to
        // ~30s of spinner in front of XP the student has already earned. Not
        // awaited — the note is an addition to a screen that is already
        // complete without it, so nothing here can hold up the recap.
        //
        // Deliberately NOT gated on `kind !== 'placement'`. Placement runs on
        // its own page and never reaches this recap, and finishSession's deps
        // are [sessionId], so `kind` is a stale closure on the boot path that
        // calls it in the same tick as setKind() (the race kindOverride
        // exists to dodge) — the check would read null and fire anyway. The
        // route refuses placement server-side.
        setNoteLoading(true)
        fetch('/api/naale/session/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        })
          .then(r => (r.ok ? r.json() : null))
          .then(note => { if (note?.summary_text) setSummaryNote(note) })
          .catch(() => {})
          .finally(() => setNoteLoading(false))
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

    // The one place a resolved question is discarded, so the one place it gets
    // recorded — including the correct-answer auto-advance path, which never
    // passes through a click handler. Unanswered questions are skipped: there
    // would be nothing resolved to show.
    const leaving = currentSnapshot.current
    if (leaving && isResolved(leaving)) setHistory(h => [...h, leaving])
    setViewIndex(null)

    setResult(null)
    setSelected('')
    setOpenAnswerText('')
    setOpenResult(null)
    setOpenValidationError('')

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

  useEffect(() => {
    currentSnapshot.current = question
      ? { question, selected, result, openAnswerText, openResult }
      : null
  })

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
  //
  // bootedSessionId guards against a real re-fire, not just a defensive one:
  // loadNext's identity depends on fetchNextQuestion, which depends on
  // `kind`/`reviewExhausted` — and this very effect sets `kind` (null → a
  // real value) via setKind() below, and can flip `reviewExhausted` a moment
  // later inside the loadNext() call. Either change gives loadNext a new
  // identity, which re-triggers this effect (it's in the dependency array)
  // even though sessionId never changed — without the guard, boot() (and
  // therefore loadNext()) ran a second and sometimes third time for the same
  // session on every load, each call independently fetching and rendering a
  // freshly-randomized question: visible as one question card flashing in
  // and being replaced by another right after starting a session.
  const bootedSessionId = useRef<string | null>(null)
  useEffect(() => {
    if (!sessionId) { router.replace('/naale'); return }
    if (bootedSessionId.current === sessionId) return
    bootedSessionId.current = sessionId
    let cancelled = false
    // The guard above is claimed BEFORE the boot completes, and the cleanup
    // below cancels whatever is in flight. Those two together could strand the
    // page on its loading spinner forever: this effect depends on loadNext,
    // whose identity changes with `kind`/`reviewExhausted`, so any re-render
    // during the /status round trip ran the cleanup (cancelling the boot) and
    // then hit the guard on the re-run (refusing to start another). Nothing
    // ever called /next. The /status call takes well over a second against the
    // remote project, which is a wide window to lose that race in — observed
    // live on a fresh session after placement.
    //
    // So a boot that never finished releases its claim, letting the re-run
    // start a fresh one. Exactly one still completes: the cancelled boot bails
    // at its own `cancelled` checks.
    let completed = false
    async function boot() {
      const res = await fetch(`/api/naale/session/status?session_id=${sessionId}`)
      if (cancelled) return
      if (!res.ok) { router.replace('/naale'); return }
      const data = await res.json()
      if (cancelled) return
      qaLog('/status on boot', data)
      setAnsweredCount(data.answered_count)
      setCorrectCount(data.correct_count)
      setDeadlineMs(new Date(data.deadline_at).getTime())
      setKind(data.kind)
      if (data.translation_lang) setTranslationLang(data.translation_lang)
      if (data.ended || data.expired) { completed = true; finishSession('time_up'); return }
      completed = true
      loadNext(data.kind)
    }
    boot()
    return () => {
      cancelled = true
      if (!completed) bootedSessionId.current = null
    }
  }, [sessionId, router, loadNext, finishSession])

  // Dev-only: DevPanel's session-length override notifies subscribers only
  // when a value is actually committed (Save, or the "1 min" preset) — never
  // on every keystroke, since typing only updates DevPanel's own local
  // staged field until then. Re-fetching status here is what makes that
  // commit apply immediately to a session already open in this tab, instead
  // of requiring a manual reload. isFirstSync skips the mount-time fire,
  // since boot() above already covers the initial fetch.
  const isFirstOverrideSync = useRef(true)
  useEffect(() => {
    if (isFirstOverrideSync.current) { isFirstOverrideSync.current = false; return }
    if (!sessionId) return
    let cancelled = false
    async function revalidate() {
      const res = await fetch(`/api/naale/session/status?session_id=${sessionId}`)
      if (cancelled || !res.ok) return
      const data = await res.json()
      if (cancelled) return
      qaLog('/status on dev override save', data)
      setDeadlineMs(new Date(data.deadline_at).getTime())
      if (data.ended || data.expired) finishSession('time_up')
    }
    revalidate()
    return () => { cancelled = true }
  }, [sessionMinutesOverride, sessionId, finishSession])

  // The client clock is display-only; the server independently refuses late
  // answers (ticket 8) and stops serving questions (ticket 7). When it hits
  // zero we stop asking and close the session out ourselves too, so the
  // summary is ready without waiting on a stray answer/next call to 409/done.
  // Deferred via setTimeout rather than called directly: this repo's lint
  // rule treats a same-tick call to a state-setting function as "synchronous
  // within the effect" regardless of that function's own internal await —
  // a genuine callback (timer/promise) boundary is what it wants instead.
  //
  // `!submitting` is what stops a graded answer being thrown away. An
  // AI-graded answer sits in flight for 5-15s while Gemini scores it, and
  // closing the session inside that window means /session/end computes its
  // summary before the answer row exists — so the answer is graded, written
  // to the DB, and then silently missing from the exercise count, the XP
  // total and the AI summary's view of which topics went well. Observed on
  // session 2db627c0: the screen said 6 answered / 60 XP while a score-3
  // answer worth 4 XP landed just after ended_at, and nothing told the
  // student their answer had been dropped.
  //
  // This DELAYS the close rather than cancelling it — `submitting` is in the
  // deps, so the moment the request resolves this effect re-runs with
  // `remaining` still 0 and closes the session then. Safe against hanging
  // only because the request it waits on can't hang: gradeOpenAnswer() caps
  // each Gemini call at 15s and retries at most once, and both submit
  // handlers clear `submitting` in a `finally`. If that timeout policy ever
  // goes away, this guard needs a ceiling of its own.
  useEffect(() => {
    if (remaining === 0 && doneReason === null && !submitting) {
      qaLog('countdown reached zero — ending session')
      const id = setTimeout(() => finishSession('time_up'), 0)
      return () => clearTimeout(id)
    }
  }, [remaining, doneReason, submitting, finishSession])

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

  // Parallel to submitAnswer() above, for 'open' (AI-graded) questions —
  // posts to /open-answer instead of /answer and stores the result
  // separately (openResult, not result), since a 1-5 score isn't the same
  // shape as MCQ's boolean is_correct.
  async function submitOpenAnswer(userText: string) {
    if (!question || submitting || !userText.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/naale/session/open-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, question_id: question.id, user_text: userText }),
      })
      const data = await res.json()
      if (res.status === 409) {
        if (data.code === 'expired') {
          qaLog('/open-answer: 409 expired, ending session')
          finishSession('time_up')
          return
        }
        qaLog('/open-answer: 409 duplicate_answer, continuing to next question')
        loadNext()
        return
      }
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      qaLog('/open-answer: result', data)
      setOpenResult(data)
      setAnsweredCount(c => c + 1)
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
    // Browsing history pauses the advance rather than cancelling it for good:
    // viewIndex is a dependency, so returning to the live question re-runs
    // this effect and re-arms the timer. Without that, a student who pressed
    // back during the reward flash would come back to an answered question
    // with no Continue button and no auto-advance — a dead end.
    if (viewIndex !== null) return
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
  }, [result, loadNext, viewIndex])

  const phase: Phase = doneReason !== null ? 'done' : question === null ? 'loading' : result !== null ? 'feedback' : 'question'

  // Warn before leaving mid-session — the timer keeps running either way (no
  // pause exists), this is purely so an accidental tab-close/refresh doesn't
  // silently cost the student minutes they didn't mean to give up.
  useEffect(() => {
    if (phase !== 'question' && phase !== 'feedback') return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [phase])

  // beforeunload doesn't fire for in-app router navigation, so the "back to
  // home" link needs its own confirm — same warning, different trigger.
  function handleBackClick() {
    if (window.confirm(t('אם תעזוב/י עכשיו יתכן שתאבד/י התקדמות בתרגול. לצאת בכל זאת?'))) {
      router.push('/naale')
    }
  }

  // Aliased so the question/feedback block below can shadow `result`,
  // `selected` etc. with history-aware values. Shadowing is deliberate: it
  // means every existing reference in that block reads the question being
  // DISPLAYED, so browsing history can't leave one stray site showing the live
  // answer under an old question.
  const liveResult = result
  const liveSelected = selected
  const liveOpenResult = openResult
  const liveOpenAnswerText = openAnswerText

  const goToPrevious = () => setViewIndex(i => goBack(i, history.length))
  const goToNewer = () => setViewIndex(i => goForward(i, history.length))
  const backAvailable = canGoBack(viewIndex, history.length)

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
    const shownCorrect = summary?.correct_count ?? correctCount

    // The headline used to read `doneReason` alone — which is the CLIENT's
    // reason for stopping. Whether the clock genuinely ran out is the
    // SERVER's call (summary.reached_timer), and when the two disagree the
    // old copy announced "הזמן נגמר!" ("Time's up!") directly above a line
    // explaining the session ended BEFORE time was up. Each statement was
    // true on its own; together they read as the app arguing with itself.
    //
    // Requires a non-null `summary`, so the offline path (session/end failed
    // and the recap falls back to locally-tracked counts) keeps today's
    // wording rather than dropping to a blank headline.
    const endedEarly = summary !== null && !summary.reached_timer
    const doneEmoji = doneReason === 'bank_exhausted' ? '🎉' : endedEarly ? '🏁' : '⏰'
    const doneHeadline =
      doneReason === 'bank_exhausted' ? t('כל הכבוד! סיימת את כל התרגילים להיום')
      : endedEarly ? t('הסבב הסתיים')
      : t('הזמן נגמר!')

    content = (
      <>
        <PageHeader backHref="/naale" title={t('תרגול')} />
        {doneReason === 'no_topics' ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-2">⚠️</div>
            <h2 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4">
              {t('אין תרגילים זמינים כרגע. פנה/י למדריך/ה.')}
            </h2>
            <button
              onClick={() => router.push('/naale')}
              className="w-full max-w-xs mx-auto block py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition"
            >
              {t('לדף הבית')}
            </button>
          </div>
        ) : (
          <div className="max-w-xl mx-auto py-4">
            {/* Two-step recap: step 0 is the celebratory/rewards moment (and
                eventually the AI feedback note, item 9 — not built yet, this
                is only the pager mechanic), step 1 is "By topic" at full
                size. Collapses to one step with no dots when there's no
                per-topic breakdown to show. */}
            {summary && summary.topics.length > 0 && (
              <div className="flex items-center justify-center gap-2 mb-6">
                {[0, 1].map(i => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === resultStep ? 'w-5 bg-primary-600' : 'w-1.5 bg-fg/20'}`}
                  />
                ))}
              </div>
            )}

            {resultStep === 0 ? (
              <>
                <div className="text-center mb-8">
                  <div className="text-6xl mb-3">{doneEmoji}</div>
                  <h2 className="text-2xl font-extrabold text-fg mb-2">{doneHeadline}</h2>
                  {/* No total/percentage — the session ends on a clock, not on
                      finishing a fixed set, so there's no denominator to show. */}
                  <p className="text-fg/70">
                    {t('ענית על')} <LtrIsolate>{shownAnswered}</LtrIsolate> {t('תרגילים')}, <LtrIsolate>{shownCorrect}</LtrIsolate> {t('נכונות')}
                  </p>
                  {summary && (
                    <p className={`text-sm mt-2 ${summary.completed ? 'text-green-700 dark:text-green-400' : 'text-fg/60'}`}>
                      {summary.completed ? (
                        t('התרגול נחשב כהושלם')
                      ) : !summary.reached_timer && summary.answered_count < summary.min_answers ? (
                        `${t('התרגול לא נחשב כהושלם - לא הגעתם לסוף הזמן ולפחות')} ${summary.min_answers} ${t('תשובות')}`
                      ) : !summary.reached_timer ? (
                        // Was "הסבב הסתיים רגע לפני תום הזמן, נסו שוב" — now
                        // that the headline above says "הסבב הסתיים", that
                        // opening clause just repeated it back. This says what
                        // to do differently instead.
                        t('התרגול לא נחשב כהושלם - נסו שוב ותישארו עד סוף הזמן')
                      ) : (
                        `${t('התרגול לא נחשב כהושלם - נדרשות לפחות')} ${summary.min_answers} ${t('תשובות')}`
                      )}
                    </p>
                  )}
                  {summary && summary.completed && summary.streak === 0 && (
                    <p className="text-xs text-fg/50 mt-2">
                      {t('השלימו תרגול נוסף השבוע כדי להתחיל רצף')}
                    </p>
                  )}
                </div>

                {/* Noam's AI performance note. Rendered above the reward
                    tiles so the personal sentence is the first thing read
                    after the headline, not an afterthought under the
                    numbers. min-h reserves the card's height up front so the
                    tiles don't jump when the text arrives a moment later. */}
                {(noteLoading || summaryNote) && (
                  <div className="rounded-2xl bg-black/5 dark:bg-white/5 p-4 mb-6 min-h-[5.5rem] flex items-center gap-3">
                    {summaryNote ? (
                      <>
                        <span className="text-2xl shrink-0">{summaryNote.ui_icon}</span>
                        <p className="text-sm text-fg/80 leading-relaxed text-start">{summaryNote.summary_text}</p>
                      </>
                    ) : (
                      // Same shimmer as OpenAnswerInput's AI wait rather than
                      // a second loading idiom for the same "Gemini is
                      // thinking" state.
                      <p className="text-sm shimmer-text mx-auto">{t('מכינים לך סיכום אישי…')}</p>
                    )}
                  </div>
                )}

                {summary && (
                  <div className="grid grid-cols-3 gap-3 mb-8">
                    <div className="rounded-2xl bg-black/5 dark:bg-white/5 p-4 text-center">
                      <div className="text-xl mb-1">⭐</div>
                      <div className="text-2xl font-extrabold text-fg"><LtrIsolate>{summary.xp_earned}</LtrIsolate></div>
                      {/* "XP earned" */}
                      <div className="text-xs text-fg/60 mt-0.5">{t('נקודות XP')}</div>
                    </div>
                    <div className="rounded-2xl bg-black/5 dark:bg-white/5 p-4 text-center">
                      <div className="text-xl mb-1">🪙</div>
                      <div className="text-2xl font-extrabold text-fg"><LtrIsolate>{summary.coins_earned}</LtrIsolate></div>
                      <div className="text-xs text-fg/60 mt-0.5">{t('מטבעות')}</div>
                    </div>
                    <div className="rounded-2xl bg-black/5 dark:bg-white/5 p-4 text-center">
                      <div className="text-xl mb-1">🔥</div>
                      <div className="text-2xl font-extrabold text-fg"><LtrIsolate>{summary.streak}</LtrIsolate></div>
                      <div className="text-xs text-fg/60 mt-0.5">{t('שבועות ברצף')}</div>
                    </div>
                  </div>
                )}

                {summary && summary.topics.length > 0 ? (
                  <button
                    onClick={() => setResultStep(1)}
                    className="w-full py-3.5 rounded-2xl bg-primary-600 text-white font-semibold hover:opacity-90 transition"
                  >
                    {t('הבא')}
                  </button>
                ) : (
                  <button
                    onClick={() => router.push('/naale')}
                    className="w-full py-3.5 rounded-2xl bg-primary-600 text-white font-semibold hover:opacity-90 transition"
                  >
                    {t('לדף הבית')}
                  </button>
                )}
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-fg mb-3">{t('לפי נושא')}</h3>
                <div className="rounded-2xl bg-black/5 dark:bg-white/5 px-5 mb-6">
                  {summary!.topics.map((topic, i) => (
                    <div key={topic.topic} className={`py-4 ${i > 0 ? 'border-t border-card-border' : ''}`}>
                      <div className="flex justify-between items-baseline gap-3 mb-2">
                        <span className="font-bold text-fg flex-1 min-w-0 truncate">{topic.topic}</span>
                        <span className="text-xs font-bold text-fg bg-surface border border-card-border rounded-full px-2.5 py-1 shrink-0">
                          {t('רמה')} <LtrIsolate>{String(topic.level ?? 1)}</LtrIsolate>
                        </span>
                      </div>
                      {/* The empty half of the bar needs its own visible fill.
                          This track was `bg-surface`, which is the same value
                          as the panel behind it — so anything under 100% drew
                          its unfilled portion as a hole, and a 0% row showed
                          no bar at all rather than an empty one. Matches
                          LevelSteps' existing unfilled-dot colours rather
                          than introducing a second idiom for the same idea. */}
                      <div className="h-2.5 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${accuracyBarColor(topic.accuracy_pct)}`}
                          style={{ width: `${topic.accuracy_pct ?? 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5 text-sm">
                        <span className={`font-bold ${scoreColor(topic.accuracy_pct)}`}>
                          {topic.accuracy_pct === null ? '—' : `${Math.round(topic.accuracy_pct)}%`}
                        </span>
                        {/* "N correct" */}
                        <span className="text-fg/50"><LtrIsolate>{topic.correct}</LtrIsolate>/<LtrIsolate>{topic.answered}</LtrIsolate> {t('נכונות')}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setResultStep(0)}
                    className="rounded-2xl border border-card-border px-5 py-3.5 font-semibold text-fg/70 hover:text-fg transition"
                  >
                    {t('חזרה')}
                  </button>
                  <button
                    onClick={() => router.push('/naale')}
                    className="flex-1 py-3.5 rounded-2xl bg-primary-600 text-white font-semibold hover:opacity-90 transition"
                  >
                    {t('לדף הבית')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </>
    )
  } else {
    // phase is 'question' or 'feedback' here — question is guaranteed non-null.
    // Everything below reads the DISPLAYED question, which is an earlier one
    // while browsing history. The shadowed names are what make that automatic:
    // the answer buttons, the correct-answer markers, the score card and
    // renderText() word translation all already work off these values, so
    // "preserves the resolved state" needs no second renderer.
    const viewing = viewIndex === null ? null : history[viewIndex] ?? null
    const q = (viewing?.question ?? question)!
    const result = viewing ? viewing.result : liveResult
    const selected = viewing ? viewing.selected : liveSelected
    const openResult = viewing ? viewing.openResult : liveOpenResult
    const openAnswerText = viewing ? viewing.openAnswerText : liveOpenAnswerText
    // Derived from the shadowed openResult, so looking back at an earlier
    // answer shows what THAT answer earned rather than the live one's.
    const openReward = openResult ? gradedAnswerReward(openResult.score) : null

    content = (
      <>
        <PageHeader
          onBack={handleBackClick}
          title={t('תרגול')}
          right={remaining !== null ? (
            <span className={
              remaining <= 120000 ? 'text-red-500 dark:text-red-400 font-semibold' :
              remaining <= 300000 ? 'text-amber-500 dark:text-amber-400 font-semibold' : ''
            }>
              <LtrIsolate>{formatCountdown(remaining)}</LtrIsolate>
            </span>
          ) : null}
        />

        {/* justify-between: prompt (+ review banner / reward flash / hint)
            at the top, choices (+ submit/continue) pushed down rather than
            immediately following the prompt text. */}
        {/* key={q.id} forces a remount (and replays the enter animation)
            every time the question changes — including auto-advance and
            Continue, not just the very first question. */}
        {/* Card wrapper (bg-surface/border-card-border/shadow-sm), matching
            the same card style already used on placement's intro/done
            screens — a redesign, requested directly, of what used to be
            bare content straight on the page background. */}
        <div key={q.id} className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 flex flex-col justify-between min-h-[70vh] animate-[question-enter_0.3s_ease-out] overflow-hidden">
          <div>
            {/* Card header strip — topic + counter. Full-bleed with negative
                margins so the accent band reaches the card edges despite p-6.
                Parent's overflow-hidden + rounded-2xl handle the top corners. */}
            <div className="bg-accent-naale/10 -mx-6 -mt-6 px-6 py-3 mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold text-accent-naale uppercase tracking-wide">{q.topic}</p>
              <p className="text-xs text-fg/60 flex items-center gap-2">
                {/* Explicit dir — same reasoning as before: a translated word
                    next to an isolated number needs an unambiguous base
                    direction, or the pair can reorder in English/LTR debug mode. */}
                <span dir={debugMode && getDevLang() === 'en' ? 'ltr' : 'rtl'}>
                  {t('תרגיל')} <LtrIsolate>{viewing ? viewIndex! + 1 : answeredCount + 1}</LtrIsolate>
                </span>
                {debugMode && showQuestionBadge && (
                  <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-white/10 text-fg/70 font-mono">
                    {q.topic} · L{q.difficulty}
                    {debugTranslations && ` · 🔤${debugTranslations.used}/${debugTranslations.cap}`}
                    {` · ⏪${history.length}`}
                  </span>
                )}
              </p>
            </div>

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

            {viewing && (
              // "Viewing an earlier question — answers can't be changed"
              <div className="mb-3 rounded-xl border border-accent-naale/30 bg-accent-naale/5 dark:bg-accent-naale/10 px-3 py-2 text-xs font-medium text-accent-naale text-right">
                👁️ {t('צפייה בשאלה קודמת — לא ניתן לשנות תשובה')}
              </div>
            )}

            {hintElement}

            {q.kind === 'open' ? (
              <>
                {OPEN_EXERCISE_DISPLAY[q.topic]?.blocks(q.prompt, q.fields ?? {}).map(block => (
                  <div key={block.label} className="mb-3 text-right">
                    <p className="text-xs font-semibold text-fg/50 mb-1">{block.label}</p>
                    <p className="text-fg whitespace-pre-line">{renderText(block.text)}</p>
                  </div>
                ))}
                {OPEN_EXERCISE_DISPLAY[q.topic]?.highlightField?.(q.fields ?? {}) && (
                  <div className="inline-block rounded-full bg-accent-naale/10 text-accent-naale text-sm font-semibold px-3 py-1 mb-4">
                    {renderText(OPEN_EXERCISE_DISPLAY[q.topic]!.highlightField!(q.fields ?? {})!.text)}
                  </div>
                )}
              </>
            ) : (
              <p className="text-fg font-medium text-lg mb-4 text-right whitespace-pre-line">{renderText(q.prompt)}</p>
            )}

            {/* A confetti burst plus the reward note on a correct answer —
                relative positioning here is what anchors ConfettiBurst's
                absolutely-positioned pieces to this spot. A wrapping <div>,
                not <p>, since ConfettiBurst renders a block-level <div> and
                a <div> inside a <p> is invalid HTML (the browser would
                silently close the <p> early). */}
            {result?.is_correct && !result.is_review && (
              <div className="relative mb-4">
                {!viewing && <ConfettiBurst />}
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

          <div className="-mx-6 -mb-6 px-6 pb-6 pt-4 bg-black/[0.02] dark:bg-white/[0.03]">
            {q.kind === 'open' ? (
              <>
                {!openResult ? (
                  <>
                    <OpenAnswerInput
                      value={openAnswerText}
                      onChange={text => { setOpenAnswerText(text); if (openValidationError) setOpenValidationError('') }}
                      onSubmit={() => {
                        if (!openAnswerText.trim()) {
                          setOpenValidationError(OPEN_EXERCISE_DISPLAY[q.topic]?.emptyErrorMessage ?? '')
                          return
                        }
                        submitOpenAnswer(openAnswerText)
                      }}
                      wordLimit={OPEN_EXERCISE_DISPLAY[q.topic]?.wordLimit ?? 30}
                      loading={submitting}
                    />
                    {openValidationError && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400 text-right">{openValidationError}</p>
                    )}
                    {/* QA-only: same visibility rule as the MCQ answer hint
                        (debugMode && showHint) — lets someone testing
                        without reading Hebrew fill in a plausible answer
                        instead of composing one. Never shown to a real
                        student. */}
                    {debugMode && showHint && OPEN_EXERCISE_DISPLAY[q.topic]?.devSampleAnswers && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setOpenAnswerText(OPEN_EXERCISE_DISPLAY[q.topic]!.devSampleAnswers!.good(q.fields ?? {})); setOpenValidationError('') }}
                          className="text-xs px-2 py-1 rounded-lg border border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                        >
                          💡 QA: fill good answer
                        </button>
                        <button
                          type="button"
                          onClick={() => { setOpenAnswerText(OPEN_EXERCISE_DISPLAY[q.topic]!.devSampleAnswers!.weak(q.fields ?? {})); setOpenValidationError('') }}
                          className="text-xs px-2 py-1 rounded-lg border border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                        >
                          💡 QA: fill weak answer
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-3">
                    <div className={`rounded-2xl border p-5 text-center mb-3 ${openScoreBg(openResult.score)}`}>
                      <div className={`text-6xl font-bold ${openScoreTextColor(openResult.score)}`}>
                        <LtrIsolate>{openResult.score}</LtrIsolate>
                      </div>
                      <div className="text-fg/60 text-sm">{t('מתוך 5')}</div>
                      <div className={`text-lg font-semibold mt-1 ${openScoreTextColor(openResult.score)}`}>
                        {openScoreLabel(openResult.score)}
                      </div>
                    </div>
                    {/* The graded equivalent of MCQ's "+10 XP · +1 🪙" above.
                        Two differences, both from the 1-5 scale: the amount
                        varies by score (XP_BY_SCORE), and a coin only comes at
                        COIN_SCORE_THRESHOLD — so a 3 shows XP with no coin, and
                        a 1 (worth nothing) shows no note at all rather than a
                        deflating "+0 XP". Confetti fires only at the coin
                        threshold, matching what counts as "correct" everywhere
                        else, and never while browsing history — same rule as
                        the MCQ burst. */}
                    {openReward && openReward.xp > 0 && !openResult.is_review && (
                      <div className="relative mb-3">
                        {!viewing && openResult.score >= COIN_SCORE_THRESHOLD && <ConfettiBurst />}
                        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 text-right">
                          <LtrIsolate>
                            {openReward.coins > 0
                              ? `+${openReward.xp} XP · +${openReward.coins} 🪙`
                              : `+${openReward.xp} XP`}
                          </LtrIsolate>
                        </p>
                      </div>
                    )}

                    {/* The 3/5/10 streak milestone the server has been
                        computing and returning since this route was written,
                        and which nothing rendered until now. The count is kept
                        outside t() so the sentence translates as one phrase
                        instead of being split around the number. */}
                    {openResult.milestone && (
                      <div className="mb-3 rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5 text-right">
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                          {/* "N good answers in a row!" */}
                          🔥 <LtrIsolate>{openResult.milestone}</LtrIsolate> {t('תשובות טובות ברצף!')}
                        </p>
                      </div>
                    )}

                    <p className="text-sm text-fg/80 mt-1">{openResult.feedback}</p>
                    {/* No auto-advance for graded answers — unlike MCQ's binary
                        correct/wrong, a 1-5 score plus written feedback
                        deserves a moment to actually read before moving on.
                        Hidden while browsing history: this advances the live
                        session, which has nothing to do with the old question
                        being displayed. */}
                    {!viewing && (
                    <button
                      onClick={() => loadNext()}
                      className="w-full mt-4 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition"
                    >
                      {t('המשך')}
                    </button>
                    )}
                  </div>
                )}
              </>
            ) : q.answer_kind === 'mcq' && q.options ? (
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
                      onClick={() => {
                        if (consumeJustTranslated()) return
                        if (!result && !submitting) selectAndSubmit(option)
                      }}
                      disabled={!!result || submitting}
                      className={`w-full text-right rounded-xl border-2 p-4 transition flex items-center gap-3 disabled:cursor-default ${stateClass}`}
                    >
                      <span className={`flex-1 ${isHintedCorrect ? 'text-green-600 dark:text-green-400' : ''}`}>{renderText(option)}</span>
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
                submit — MCQ auto-submits on click above, and 'open' has its
                own submit button inside OpenAnswerInput. */}
            {!result && q.kind !== 'open' && q.answer_kind !== 'mcq' && (
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
            {result && !result.is_correct && !viewing && (
              <button
                onClick={() => loadNext()}
                className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition"
              >
                {t('המשך')}
              </button>
            )}

            {/* Browsing controls. The "back to the current question" jump is
                not something Noam asked for, but view-only navigation without
                it strands a student several questions back with no way home —
                it's the other half of the button he did ask for, not a
                separate feature. */}
            {(backAvailable || viewing) && (
              <div className="mt-4 flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={goToPrevious}
                  disabled={!backAvailable}
                  className="px-3 py-2 rounded-xl border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent transition"
                >
                  {t('חזרה לשאלה הקודמת')}
                </button>
                {viewing && (
                  <>
                    <button
                      type="button"
                      onClick={goToNewer}
                      className="px-3 py-2 rounded-xl border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5 transition"
                    >
                      {t('השאלה הבאה')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewIndex(null)}
                      className="px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:opacity-90 transition"
                    >
                      {t('חזרה לשאלה הנוכחית')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* N4: "Found a mistake in the question? Report it to us."
            Deliberately OUTSIDE the card, centered under it. Two earlier
            placements inside the card were worse: at the end of the question
            block it shared a row with the mandatory-word chip and read as part
            of the question's own content, and in the card footer it sat among
            the navigation controls, where a mis-click costs a student their
            place. Out here it can't collide with anything, and its position
            says what it is — a note ABOUT this question, not another control
            for answering it. The space below the card is otherwise empty.

            Rendered for every question, including while browsing history:
            noticing a mistake often happens on the way back, and the report is
            about the question, not about where the session currently is. */}
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setReportingQuestionId(q.id)}
            className="text-xs text-fg/50 transition-colors hover:text-fg/80"
          >
            🚩 {t('מצאתם טעות בשאלה? דווחו לנו')}
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen md:flex">
      <NaaleSidebar role="student" />
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">{content}</div>
      {popoverElement}
      {/* Rendered at the page root, not inside the question container, so the
          backdrop covers the whole viewport rather than one card. */}
      {reportingQuestionId && (
        <ReportQuestionModal
          questionId={reportingQuestionId}
          sessionId={sessionId}
          onClose={() => setReportingQuestionId(null)}
        />
      )}
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
