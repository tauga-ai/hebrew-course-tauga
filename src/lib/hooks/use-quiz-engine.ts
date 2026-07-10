'use client'

import { useEffect, useState } from 'react'
import { useResource } from './use-resource'

export interface QuizProgressEntry<E> {
  question_id: number
  selected_option: number
  is_correct: boolean
  correct_option: number | null
  explanation: E | null
}

export interface UseQuizEngineConfig {
  /** Topic key or set id — the hook re-fetches/re-seeds when this changes. */
  entityId: string
  /** Gate: fetching doesn't start until this is truthy. */
  session: unknown | null
  questionsUrl: string
  progressUrl: string
  entityMetaUrl: string
  /** Key the entity-meta list response nests its array under (e.g. 'topics' | 'sets'). */
  entityMetaKey: string
  submitUrl: string
  /** Merged into the submit body alongside question_id/selected_option (e.g. {topic} or {set_id}). */
  submitBodyExtra: Record<string, unknown>
  /** Shown when a submit fails without a server-provided message. */
  submitErrorMessage: string
  /**
   * Exam-style mode: answers are still recorded immediately (unchanged),
   * but the caller should withhold correctness from the UI — via the
   * returned `revealed` flag — until every question in the set has been
   * answered, at which point everything unlocks together. Omit (or leave
   * false) for the normal self-practice behavior of immediate feedback.
   */
  deferFeedback?: boolean
}

/**
 * Shared engine behind the tzav-rishon and makbatzim practice pages:
 * parallel fetch of questions + progress + entity-meta, seeding
 * currentIndex to the first unanswered question exactly once per entity,
 * optimistic progress updates on submit, and prev/next/jump navigation.
 * Deliberately agnostic to bilingual content — `Q`'s shape (plain segments
 * vs. `{he, ar}`) is entirely the caller's concern; this hook only ever
 * touches `id` on questions and treats `explanation` as an opaque payload.
 */
export function useQuizEngine<Q extends { id: number }, M extends { key: string }, E>(
  config: UseQuizEngineConfig
) {
  const { entityId, session, questionsUrl, progressUrl, entityMetaUrl, entityMetaKey, submitUrl, submitBodyExtra, submitErrorMessage, deferFeedback } = config

  const [currentIndex, setCurrentIndex] = useState(0)
  const [seededForEntity, setSeededForEntity] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [retryToken, setRetryToken] = useState(0)
  // selectOption applies its result here immediately, ahead of the next
  // progress refetch (there isn't one — these pages never refetch progress
  // after mount) — cleared whenever entityId changes.
  const [optimisticProgress, setOptimisticProgress] = useState<Record<number, QuizProgressEntry<E>>>({})
  const retry = `&_r=${retryToken}`

  const { data: qData, loading: qLoading, error: qError } = useResource<{ questions: Q[] }>(
    session ? `${questionsUrl}${retry}` : null
  )
  const { data: pData, loading: pLoading, error: pError } = useResource<{ progress: QuizProgressEntry<E>[] }>(
    session ? `${progressUrl}${retry}` : null
  )
  const { data: mData, loading: mLoading, error: mError } = useResource<Record<string, M[]>>(
    session ? `${entityMetaUrl}?_r=${retryToken}` : null
  )

  const questions = qData?.questions ?? null
  const entityMeta = mData?.[entityMetaKey]?.find(m => m.key === entityId) ?? null
  const progress: Record<number, QuizProgressEntry<E>> = {}
  for (const p of pData?.progress ?? []) progress[p.question_id] = p
  Object.assign(progress, optimisticProgress)

  const loadError = qError || pError || mError

  // Adjusting state when a prop changes (React's recommended pattern —
  // https://react.dev/learn/you-might-not-need-an-effect) rather than an
  // effect: optimistic overrides are specific to the entity that was
  // answered, dropped when navigating to a different entity; currentIndex
  // is seeded to the first unanswered question exactly once per entity, as
  // soon as both questions and progress have finished loading (not on
  // every later progress update, e.g. right after answering, which would
  // jump the student back to an earlier question).
  if (Object.keys(optimisticProgress).length > 0 && seededForEntity !== entityId) {
    setOptimisticProgress({})
  }
  if (questions && pData && seededForEntity !== entityId) {
    const firstUnanswered = questions.findIndex(q => !(q.id in progress))
    setCurrentIndex(firstUnanswered === -1 ? 0 : firstUnanswered)
    setSeededForEntity(entityId)
  }

  const loading = qLoading || pLoading || mLoading || questions === null || entityMeta === null || seededForEntity !== entityId
  const current = questions && !loading ? questions[currentIndex] : null
  const answered = current ? progress[current.id] : undefined
  const total = questions?.length ?? 0
  const answeredCount = Object.keys(progress).length
  const resultsByQuestion = Object.fromEntries(
    Object.entries(progress).map(([qid, p]) => [qid, p.is_correct])
  )
  // Exam mode: nothing unlocks until the whole set is answered, then
  // everything reveals together — never gated per-question.
  const revealed = !deferFeedback || (total > 0 && answeredCount === total)

  // In exam mode, every answer's optimistic entry was recorded with the
  // correctness fields withheld by the server (see selectOption below) —
  // once the set completes, re-fetch progress once to backfill the real
  // is_correct/correct_option/explanation for every question, not just the
  // last one answered. Re-fires per entity only (progressUrl embeds it).
  useEffect(() => {
    if (!deferFeedback || !revealed) return
    let cancelled = false
    fetch(progressUrl)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data?.progress) return
        setOptimisticProgress(prev => {
          const merged = { ...prev }
          for (const p of data.progress as QuizProgressEntry<E>[]) merged[p.question_id] = p
          return merged
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [deferFeedback, revealed, progressUrl])

  async function selectOption(optionNum: number) {
    if (submitting || !current) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...submitBodyExtra, question_id: current.id, selected_option: optionNum }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      setOptimisticProgress(prev => ({
        ...prev,
        [current.id]: {
          question_id: current.id,
          selected_option: optionNum,
          // In exam mode, before the set is complete, the server withholds
          // all three of these — these placeholders are never rendered
          // (revealed is false) and get overwritten by the backfill effect
          // above once the set completes.
          is_correct: data.is_correct ?? false,
          correct_option: data.correct_option ?? null,
          explanation: data.explanation ?? null,
        },
      }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : submitErrorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  function goPrev() {
    setCurrentIndex(i => Math.max(0, i - 1))
  }
  function goNext() {
    setCurrentIndex(i => Math.min(total - 1, i + 1))
  }
  function jumpTo(i: number) {
    setCurrentIndex(i)
  }
  function retryLoad() {
    setRetryToken(t => t + 1)
  }

  return {
    loading, loadError, questions, entityMeta,
    currentIndex, current, progress, answered,
    total, answeredCount, resultsByQuestion, revealed,
    submitting, error, selectOption,
    goPrev, goNext, jumpTo, retryLoad,
  }
}
