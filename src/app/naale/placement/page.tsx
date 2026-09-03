'use client'

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { t, debugMode, getDevLang, subscribeDevLang } from '@/lib/dev-i18n'
import { getShowHint, subscribeShowHint } from '@/lib/dev-hint'
import { useHoldToTranslate } from '@/lib/naale/use-hold-to-translate'
import { useNaaleProfile } from '@/lib/naale/use-naale-profile'
import { OpenAnswerInput } from '@/components/naale/OpenAnswerInput'
import { SpeechToTextToggle } from '@/components/naale/SpeechToTextToggle'
import { useSpeechToText } from '@/lib/hooks/use-speech-to-text'
import { OPEN_EXERCISE_DISPLAY } from '@/lib/naale/open-exercise-display'

interface ServedQuestion {
  id: string
  topic: string
  difficulty: number
  // Which content table this came from — naale_questions (mcq) or
  // naale_open_questions (open, AI-graded free text), matching
  // /placement/next's own PublicQuestion discriminant.
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
}

interface AnswerResult {
  is_correct: boolean
  correct_answer: string
  explanation?: string
}

interface OpenAnswerResult {
  score: number
  feedback: string
}

// Derived, not stored — same rationale as ticket 10's session page.
type Phase = 'intro' | 'loading' | 'question' | 'feedback' | 'done'

// Upper bound on how long a correct answer's auto-advance will wait on a
// slow prefetch before giving up and advancing anyway — matches
// session/page.tsx's SAFETY_CAP_MS (same reasoning, not a measured value,
// just comfortably above ordinary network variance).
const SAFETY_CAP_MS = 5000

function PlacementRunner() {
  const router = useRouter()
  const sessionId = useSearchParams().get('session_id')
  const [translationLang, setTranslationLang] = useState<'ru' | 'ar'>('ru')
  const { renderText, consumeJustTranslated, popoverElement, hintElement, debugUsage: debugTranslations } = useHoldToTranslate(sessionId, translationLang)

  const [phase, setPhase] = useState<Phase>('intro')
  const [question, setQuestion] = useState<ServedQuestion | null>(null)
  const [questionNumber, setQuestionNumber] = useState(0)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState('')
  const [result, setResult] = useState<AnswerResult | null>(null)
  // 'open' (AI-graded) questions use their own text/result state — see
  // session/page.tsx's matching state for why.
  const [openAnswerText, setOpenAnswerText] = useState('')
  const [openResult, setOpenResult] = useState<OpenAnswerResult | null>(null)
  const [openValidationError, setOpenValidationError] = useState('')
  // QA-only: loading flag for the picture-description "fill good answer"
  // button's fetch to /api/naale/dev/picture-description-sample — see
  // session/page.tsx's matching buttons for the full reasoning.
  const [fetchingPictureSample, setFetchingPictureSample] = useState(false)
  // Same mic-into-openAnswerText wiring as session/page.tsx — see that file's
  // matching state for why, including following the Dev Panel language
  // toggle for recognition language.
  const devLang = useSyncExternalStore(subscribeDevLang, getDevLang, getDevLang)
  const { isListening, start: startListening, stop: stopListening, supported: speechSupported } = useSpeechToText({
    continuous: false,
    lang: devLang === 'en' ? 'en-US' : 'he-IL',
    onTranscript: text => { setOpenAnswerText(text); if (openValidationError) setOpenValidationError('') },
  })
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const showHint = useSyncExternalStore(subscribeShowHint, getShowHint, getShowHint)

  // Background-prefetch target for the next placement question — same
  // ref-based approach as session/page.tsx's prefetch (see that file's doc
  // comment): filled in only once THIS answer's result is known, and a ref
  // rather than state so loadNext()'s identity doesn't churn every question.
  const prefetchedQuestion = useRef<{ question: ServedQuestion; question_number: number; total: number } | null>(null)
  const prefetchedDone = useRef(false)
  // Resolves once the prefetch below has landed in one of the two refs above
  // — lets the correct-answer auto-advance effect wait for the prefetch
  // instead of firing on a blind timer, matching session/page.tsx's fix
  // (commit c73d74c) for the same loading-spinner flash this page still had.
  const prefetchPromise = useRef<Promise<void> | null>(null)

  useEffect(() => {
    if (!sessionId) router.replace('/naale')
  }, [sessionId, router])

  // refresh() bypasses the shared cache on purpose — this page loads right
  // after the pre-session sheet, which is the exact moment translation_lang
  // could have just changed. A cached value here would be stale for the
  // same reason staff/page.tsx's openPracticeSheet() needs a fresh read.
  const { refresh: refreshProfile } = useNaaleProfile('student')
  useEffect(() => {
    refreshProfile().then(profile => {
      if (profile?.translation_lang) setTranslationLang(profile.translation_lang)
    })
  }, [refreshProfile])

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
    setOpenAnswerText('')
    setOpenResult(null)
    setOpenValidationError('')

    if (prefetchedQuestion.current) {
      const { question, question_number, total } = prefetchedQuestion.current
      prefetchedQuestion.current = null
      prefetchedDone.current = false
      prefetchPromise.current = null
      setQuestion(question)
      setQuestionNumber(question_number)
      setTotal(total)
      setPhase('question')
      return
    }
    if (prefetchedDone.current) {
      prefetchedDone.current = false
      prefetchPromise.current = null
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
    let timeoutId: ReturnType<typeof setTimeout>
    // Assigned here, synchronously, so the auto-advance effect below always
    // reads a live promise off the ref rather than racing to see it before
    // this effect has run — only the fetchNextQuestion() call itself is
    // deferred (same react-hooks/set-state-in-effect reason as before).
    prefetchPromise.current = new Promise<void>(resolve => {
      timeoutId = setTimeout(() => {
        fetchNextQuestion().then(outcome => {
          if (!cancelled) {
            if ('question' in outcome) prefetchedQuestion.current = outcome
            else if ('done' in outcome) prefetchedDone.current = true
            // 'error' outcome: left unset — loadNext()'s fallback fetch retries for real.
          }
          resolve()
        })
      }, 0)
    })
    return () => { cancelled = true; clearTimeout(timeoutId) }
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

  // Parallel to submitAnswer() above, for 'open' (AI-graded) questions —
  // posts to /placement/open-answer instead of /placement/answer. No
  // level/milestone handling here, matching how placement's existing MCQ
  // path is already simpler than the practice session's (placement levels
  // are all set once by /placement/finish).
  async function submitOpenAnswer(userText: string) {
    if (!question || submitting || !userText.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/naale/placement/open-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, question_id: question.id, user_text: userText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      setOpenResult(data)
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
  //
  // Waits for the prefetch too, not just the 700ms flash — same fix as
  // session/page.tsx (commit c73d74c): advancing on a blind timer meant
  // that whenever the prefetch hadn't resolved yet, loadNext() fell into
  // its loading-spinner fallback right after the correct-answer flash. This
  // page had the same gap since it was built before that fix and never
  // got it ported over.
  useEffect(() => {
    if (!(phase === 'feedback' && result?.is_correct)) return
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
  }, [phase, result, loadNext])

  // Warn before leaving mid-placement — same rationale as the practice
  // session page's matching guard (see that file's comment for why this
  // can't just be a shared hook: two call sites, ~6 lines each, not worth
  // the abstraction).
  useEffect(() => {
    if (phase !== 'question' && phase !== 'feedback') return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [phase])

  function handleBackClick() {
    if (window.confirm(t('אם תעזוב/י עכשיו יתכן שתאבד/י התקדמות בתרגול. לצאת בכל זאת?'))) {
      router.push('/naale')
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
      <PageHeader onBack={handleBackClick} title={t('שאלון קצר')} />

      {/* justify-between: prompt (+ hint) at the top, choices (+ submit/
          continue) pushed down rather than immediately following the
          prompt text. */}
      {/* key={q.id} forces a remount (and replays the enter animation)
          every time the question changes. */}
      {/* Card wrapper, matching this same page's intro/done screens' card
          style — a redesign, requested directly, of what used to be bare
          content straight on the page background. */}
      <div key={q.id} className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 flex flex-col justify-between min-h-[70vh] animate-[question-enter_0.3s_ease-out] overflow-hidden">
        <div>
          {/* Card header strip — topic + counter. Same full-bleed negative-margin
              approach as session/page.tsx. */}
          <div className="bg-accent-naale/10 -mx-6 -mt-6 px-6 py-3 mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold text-accent-naale uppercase tracking-wide">{q.topic}</p>
            <p className="text-xs text-fg/60 flex items-center gap-2">
              {t('שאלה')} <LtrIsolate>{questionNumber}</LtrIsolate> {t('מתוך')} <LtrIsolate>{total}</LtrIsolate>
              {debugMode && debugTranslations && (
                <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-white/10 text-fg/70 font-mono">
                  🔤{debugTranslations.used}/{debugTranslations.cap}
                </span>
              )}
            </p>
          </div>

          {hintElement}

          {q.kind === 'open' ? (
            <>
              {q.topic === 'תיאור תמונה בקול' && q.fields?.picture_number && (
                // eslint-disable-next-line @next/next/no-img-element -- source image dimensions vary per picture; same rationale as makbatzim's image questions.
                <img
                  src={`/api/naale/pictures/${q.fields.picture_number}`}
                  alt=""
                  className="w-full max-w-sm mx-auto aspect-[4/3] object-contain bg-black/5 dark:bg-white/5 rounded-xl mb-4 border border-card-border"
                />
              )}
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
                  {q.topic === 'תיאור תמונה בקול' && (
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-fg/80">{t('התשובה שלי')}</label>
                      <SpeechToTextToggle
                        isListening={isListening}
                        supported={speechSupported}
                        onToggle={() => (isListening ? stopListening() : startListening())}
                      />
                    </div>
                  )}
                  {q.topic === 'תיאור תמונה בקול' && isListening && (
                    <p className="text-xs text-red-500 dark:text-red-400 mb-1 animate-pulse text-right">{t('🎤 מקליט... דבר בעברית')}</p>
                  )}
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
                      (debugMode && showHint) — see session/page.tsx's
                      matching buttons for the full reasoning. */}
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
                  {/* QA-only, picture-description special case — see
                      session/page.tsx's matching buttons for the full
                      reasoning. */}
                  {debugMode && showHint && q.topic === 'תיאור תמונה בקול' && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={fetchingPictureSample}
                        onClick={async () => {
                          setFetchingPictureSample(true)
                          try {
                            const res = await fetch(`/api/naale/dev/picture-description-sample?question_id=${q.id}`)
                            if (res.ok) {
                              const data = await res.json()
                              setOpenAnswerText(data.good)
                              setOpenValidationError('')
                            }
                          } finally {
                            setFetchingPictureSample(false)
                          }
                        }}
                        className="text-xs px-2 py-1 rounded-lg border border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 disabled:opacity-50"
                      >
                        💡 QA: fill good answer
                      </button>
                      <button
                        type="button"
                        onClick={() => { setOpenAnswerText('חתול. שולחן. אתמול היה.'); setOpenValidationError('') }}
                        className="text-xs px-2 py-1 rounded-lg border border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                      >
                        💡 QA: fill weak answer
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-3">
                  {/* Deliberately neutral, unlike session/page.tsx's colored score card —
                      placement's own intro copy promises "no grade, no time pressure," so an
                      alarm-colored "Needs improvement" verdict here would contradict that. Just
                      the number for context; the constructive feedback text below does the
                      actual work. */}
                  <div className="rounded-2xl border border-card-border bg-surface p-5 text-center mb-3">
                    <div className="text-6xl font-bold text-fg">
                      <LtrIsolate>{openResult.score}</LtrIsolate>
                    </div>
                    <div className="text-fg/60 text-sm">{t('מתוך 5')}</div>
                  </div>
                  <p className="text-sm text-fg/80 mt-1">{openResult.feedback}</p>
                  <button
                    onClick={() => loadNext()}
                    className="w-full mt-4 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition"
                  >
                    {t('המשך')}
                  </button>
                </div>
              )}
            </>
          ) : q.answer_kind === 'mcq' && q.options ? (
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

          {!result && q.kind !== 'open' && q.answer_kind !== 'mcq' && (
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
      {popoverElement}
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
