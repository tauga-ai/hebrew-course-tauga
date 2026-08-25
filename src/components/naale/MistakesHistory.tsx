'use client'

import { useState } from 'react'
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
 * Shows a student their wrong MCQ answers grouped by topic, so they can
 * see at a glance which areas need more practice.
 *
 * Only includes answers recorded after the naale_answers_chosen_answer
 * migration — pre-migration rows are silently excluded (chosen_answer is null).
 * Nothing is shown to a student with no recorded mistakes yet.
 */
export function MistakesHistory() {
  const { data, loading, error } = useResource<{ mistakes: Mistake[] }>('/api/naale/my-mistakes')
  const [openTopic, setOpenTopic] = useState<string | null>(null)

  if (loading) return (
    <>
      <h2 className="text-sm font-semibold text-fg/70 mb-2 mt-6">{t('שגיאות לפי נושא')}</h2>
      <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-4 space-y-3 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 rounded-xl bg-black/5 dark:bg-white/5" />
        ))}
      </div>
    </>
  )
  if (error || !data) return null
  if (data.mistakes.length === 0) return null

  // Group by topic, preserving most-recent-first order within each group
  const byTopic = new Map<string, Mistake[]>()
  for (const m of data.mistakes) {
    const group = byTopic.get(m.topic) ?? []
    group.push(m)
    byTopic.set(m.topic, group)
  }
  const topics = [...byTopic.entries()]

  return (
    <>
      <h2 className="text-sm font-semibold text-fg/70 mb-2 mt-6">{t('שגיאות לפי נושא')}</h2>
      <div className="bg-surface rounded-2xl shadow-sm border border-card-border overflow-hidden">
        {topics.map(([topic, mistakes], i) => {
          const isOpen = openTopic === topic
          return (
            <div key={topic} className={i > 0 ? 'border-t border-card-border' : ''}>
              <button
                onClick={() => setOpenTopic(isOpen ? null : topic)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 p-4 text-start hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-semibold text-fg truncate">{topic}</span>
                  <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                    <LtrIsolate>{String(mistakes.length)}</LtrIsolate>
                  </span>
                </span>
                <span className={`text-fg/40 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {isOpen && (
                <div className="border-t border-card-border">
                  {mistakes.map((m, j) => (
                    <div
                      key={m.id}
                      className={`px-4 py-3 ${j > 0 ? 'border-t border-card-border' : ''} bg-black/[0.01] dark:bg-white/[0.02]`}
                    >
                      {/* Date */}
                      <p className="text-[0.65rem] text-fg/40 mb-1.5 text-start">
                        <LtrIsolate>{new Date(m.answered_at).toLocaleDateString('he-IL')}</LtrIsolate>
                      </p>

                      {/* Question prompt */}
                      <p className="text-sm text-fg mb-2 text-right leading-relaxed">{m.prompt}</p>

                      {/* Wrong → correct, RTL-correct layout */}
                      <div className="space-y-1">
                        <div className="flex items-start justify-end gap-2">
                          <p className="text-sm text-red-700 dark:text-red-300 text-right">{m.chosen_answer}</p>
                          <span className="text-red-500 dark:text-red-400 shrink-0 font-bold text-sm leading-5">✗</span>
                        </div>
                        <div className="flex items-start justify-end gap-2">
                          <p className="text-sm text-green-700 dark:text-green-300 text-right">{m.correct_answer}</p>
                          <span className="text-green-600 dark:text-green-400 shrink-0 font-bold text-sm leading-5">✓</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
