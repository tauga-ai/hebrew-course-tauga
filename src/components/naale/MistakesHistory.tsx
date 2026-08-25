'use client'

import { useResource } from '@/lib/hooks/use-resource'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { t } from '@/lib/dev-i18n'

interface Mistake {
  id: string
  session_id: string
  topic: string
  prompt: string
  chosen_answer: string
  correct_answer: string
  answered_at: string
}

/**
 * Shows a student their wrong MCQ answers from past sessions, so they can
 * review what they got wrong and learn the correct answers.
 *
 * Only includes answers recorded after the naale_answers_chosen_answer
 * migration — pre-migration rows are silently excluded (chosen_answer is null).
 * Nothing is shown to a student with no recorded mistakes yet.
 */
export function MistakesHistory() {
  const { data, loading, error } = useResource<{ mistakes: Mistake[] }>('/api/naale/my-mistakes')

  if (loading) return null
  if (error || !data) return null
  if (data.mistakes.length === 0) return null

  return (
    <>
      {/* "Mistakes from previous sessions" */}
      <h2 className="text-sm font-semibold text-fg/70 mb-2 mt-6">{t('שגיאות מתרגולים קודמים')}</h2>
      <div className="bg-surface rounded-2xl shadow-sm border border-card-border overflow-hidden">
        {data.mistakes.map((m, i) => (
          <div
            key={m.id}
            className={`p-4 ${i > 0 ? 'border-t border-card-border' : ''}`}
          >
            {/* Topic + date */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[0.7rem] font-semibold text-accent-naale uppercase tracking-wide">
                {m.topic}
              </span>
              <span className="text-[0.65rem] text-fg/40">
                <LtrIsolate>{new Date(m.answered_at).toLocaleDateString('he-IL')}</LtrIsolate>
              </span>
            </div>

            {/* Question prompt */}
            <p className="text-sm text-fg mb-3 text-right leading-relaxed">{m.prompt}</p>

            {/* Wrong answer the student chose */}
            <div className="flex items-start gap-2 mb-1.5">
              <span className="text-red-500 dark:text-red-400 shrink-0 font-bold text-sm">✗</span>
              <p className="text-sm text-red-700 dark:text-red-300 text-right flex-1">{m.chosen_answer}</p>
            </div>

            {/* Correct answer */}
            <div className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 shrink-0 font-bold text-sm">✓</span>
              <p className="text-sm text-green-700 dark:text-green-300 text-right flex-1">{m.correct_answer}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
