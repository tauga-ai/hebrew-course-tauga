'use client'

import { useMemo, useState } from 'react'
import { useResource } from '@/lib/hooks/use-resource'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { OPEN_EXERCISE_DISPLAY } from '@/lib/naale/open-exercise-display'
import { diffAnswers, promptSummary } from '@/lib/naale/mistakes'
import { t } from '@/lib/dev-i18n'

interface Mistake {
  id: string
  kind: 'mcq' | 'open'
  topic: string
  session_id: string
  prompt: string
  chosen_answer: string
  answered_at: string
  attempt_count: number
  /** MCQ only. */
  correct_answer?: string
  /** Open only — stands in for a correct answer, since there isn't one. */
  feedback?: string
  /** Open only — display fields, already stripped of grading-only keys. */
  fields?: Record<string, string>
}

interface MistakesResponse {
  mistakes: Mistake[]
  /** Before the cap. Larger than mistakes.length means the list is partial. */
  total: number
}

const ALL = '__all__'

/**
 * The questions a student is still getting wrong — one flat, scannable list.
 *
 * Previously a topic accordion holding a second accordion of entries. Three
 * things were wrong with that: only one topic could be open at a time (the
 * open-topic state was a single value), any content was two clicks and a
 * scroll away, and a red count per topic made the first thing on screen a
 * scoreboard of failure. Flat rows put the whole list in view, so "three of
 * these are story continuation" arrives without interaction, and topic becomes
 * a filter rather than a container.
 *
 * The row's second line is the point. Sentence-correction answers differ from
 * the correct one by a single word, so showing both in full asks the student
 * to spot the difference themselves — the one job this screen exists to do for
 * them. diffAnswers() trims the shared wording and shows only what changed,
 * as a struck-through span next to its replacement: the contrast is spatial,
 * so it survives colour-blindness rather than resting on red-versus-green.
 *
 * Both banks appear. An AI-graded exercise has no single correct answer, so its
 * row is marked as writing and expands to the exercise as the student saw it —
 * blocks and mandatory word come from OPEN_EXERCISE_DISPLAY, the same registry
 * the session screen renders from, because the prompt alone is not the question.
 */
export function MistakesHistory() {
  const { data, loading, error } = useResource<MistakesResponse>('/api/naale/my-mistakes')
  const [topic, setTopic] = useState<string>(ALL)
  const [openId, setOpenId] = useState<string | null>(null)

  // Memoised because a fresh `?? []` each render would defeat both useMemos below.
  const mistakes = useMemo(() => data?.mistakes ?? [], [data])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of mistakes) map.set(m.topic, (map.get(m.topic) ?? 0) + 1)
    return [...map.entries()]
  }, [mistakes])

  const visible = useMemo(
    () => (topic === ALL ? mistakes : mistakes.filter(m => m.topic === topic)),
    [mistakes, topic]
  )

  const heading = <h2 className="text-sm font-semibold text-fg/70">{t('שגיאות לחזרה')}</h2>

  if (loading) return (
    <div className="mt-6">
      {heading}
      <div className="mt-2 bg-surface rounded-2xl shadow-sm border border-card-border p-4 space-y-3 animate-pulse">
        {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-xl bg-black/5 dark:bg-white/5" />)}
      </div>
    </div>
  )

  // A failed load used to render nothing, which a student reads as "I have no
  // mistakes" — the opposite of the truth, and unfalsifiable from their side.
  if (error) return (
    <div className="mt-6">
      {heading}
      <p className="mt-2 text-xs text-fg/50 bg-surface rounded-2xl border border-card-border p-4">
        {t('לא ניתן לטעון את השגיאות')}
      </p>
    </div>
  )

  if (!data || mistakes.length === 0) return null

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        {heading}
        <span className="text-xs font-bold text-accent-naale tabular-nums">
          <LtrIsolate>{String(visible.length)}</LtrIsolate>
        </span>
      </div>

      {/* Topic as a filter, not a container: several topics stay in view at
          once, and the chips carry the counts without a red pill per topic. */}
      {counts.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <TopicChip label={t('הכל')} count={mistakes.length} active={topic === ALL} onClick={() => { setTopic(ALL); setOpenId(null) }} />
          {counts.map(([name, n]) => (
            <TopicChip key={name} label={name} count={n} active={topic === name} onClick={() => { setTopic(name); setOpenId(null) }} />
          ))}
        </div>
      )}

      <div className="bg-surface rounded-2xl shadow-sm border border-card-border overflow-hidden">
        {visible.map((m, i) => {
          const isOpen = openId === m.id
          const display = m.kind === 'open' ? OPEN_EXERCISE_DISPLAY[m.topic] : undefined
          const highlight = display?.highlightField?.(m.fields ?? {})
          const diff = m.kind === 'mcq' && m.correct_answer !== undefined
            ? diffAnswers(m.chosen_answer, m.correct_answer)
            : null

          return (
            <div key={m.id} className={i > 0 ? 'border-t border-card-border' : ''}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : m.id)}
                aria-expanded={isOpen}
                className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-start hover:bg-black/5 dark:hover:bg-white/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-naale"
              >
                {/* Solid for multiple-choice, faded for written — the two need
                    reading differently, and a shape says so without a label. */}
                <span
                  className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${m.kind === 'mcq' ? 'bg-accent-naale' : 'bg-accent-naale/40'}`}
                  aria-hidden
                />

                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8rem] text-fg/85 truncate">{promptSummary(m.prompt)}</span>

                  {diff ? (
                    <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-[0.8rem]">
                      <span className="text-red-700 dark:text-red-300 line-through decoration-1">{diff.was}</span>
                      <span className="text-fg/35 text-[0.7rem]">→</span>
                      <span className="text-green-700 dark:text-green-300 font-medium">{diff.is}</span>
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-[0.7rem] text-fg/40">{t('כתיבה')}</span>
                  )}
                </span>

                <span className="shrink-0 flex items-baseline gap-1.5 text-[0.65rem] text-fg/40 tabular-nums">
                  {/* The review system re-serves missed questions, so without
                      this the same question appeared once per re-attempt. */}
                  {m.attempt_count > 1 && (
                    <span className="text-accent-naale font-bold"><LtrIsolate>{`×${m.attempt_count}`}</LtrIsolate></span>
                  )}
                  <LtrIsolate>{new Date(m.answered_at).toLocaleDateString('he-IL')}</LtrIsolate>
                </span>
              </button>

              {isOpen && (
                <div className="px-3.5 pb-3.5 ps-7 bg-black/[0.01] dark:bg-white/[0.02]">
                  {m.kind === 'open' ? (
                    <>
                      {(display?.blocks(m.prompt, m.fields ?? {}) ?? []).map(block => (
                        <p key={block.label} className="text-[0.8rem] text-fg mb-2 leading-relaxed">
                          <span className="text-fg/40 text-[0.7rem]">{block.label}: </span>
                          {block.text}
                        </p>
                      ))}
                      {highlight && (
                        <p className="text-[0.7rem] text-accent-naale mb-2">
                          {highlight.label}: {highlight.text}
                        </p>
                      )}
                      <p className="text-[0.65rem] text-fg/40">{t('התשובה שלך')}</p>
                      <p className="text-[0.8rem] text-fg/80 mb-2 whitespace-pre-wrap">{m.chosen_answer}</p>
                      <p className="text-[0.65rem] text-fg/40">{t('משוב')}</p>
                      <p className="text-[0.8rem] text-fg/70 leading-relaxed">{m.feedback}</p>
                    </>
                  ) : (
                    <>
                      {/* The full prompt, since the row shows only its last
                          line and a reading-comprehension question needs the
                          paragraph above it to make sense. */}
                      <p className="text-[0.8rem] text-fg mb-2 leading-relaxed whitespace-pre-line">{m.prompt}</p>
                      <p className="text-[0.65rem] text-fg/40">{t('התשובה שלך')}</p>
                      <p className="text-[0.8rem] text-red-700 dark:text-red-300 mb-2">{m.chosen_answer}</p>
                      <p className="text-[0.65rem] text-fg/40">{t('התשובה הנכונה')}</p>
                      <p className="text-[0.8rem] text-green-700 dark:text-green-300">{m.correct_answer}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* The cap has to admit itself: a truncated list that says nothing reads
          as the complete history. */}
      {data.total > mistakes.length && (
        <p className="text-[0.65rem] text-fg/40 mt-2 text-center">{t('מוצגות השגיאות האחרונות')}</p>
      )}
    </div>
  )
}

function TopicChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  // min-h-[44px] + items-center, not extra py: these wrap into rows, and
  // growing them with padding alone left the row gap too tight to tell
  // adjacent chips apart by touch. Measured at 27px tall in the mobile QA pass
  // — seven of them side by side, so a mis-tap landed on a neighbouring filter
  // rather than on nothing. items-baseline swapped for items-center because
  // the label no longer fills the box.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 min-h-[44px] text-[0.7rem] px-3 rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-naale ${
        active
          ? 'bg-accent-naale border-accent-naale text-white'
          : 'bg-surface border-card-border text-fg/70 hover:bg-black/5 dark:hover:bg-white/5'
      }`}
    >
      <span>{label}</span>
      <span className="text-[0.6rem] opacity-60 tabular-nums"><LtrIsolate>{String(count)}</LtrIsolate></span>
    </button>
  )
}
