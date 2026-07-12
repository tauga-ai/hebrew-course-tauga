'use client'

import { useState } from 'react'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import { scoreColor } from '@/lib/score-color'
import { SENTENCE_SETS } from '@/lib/sentence-exercises'
import type { SentenceFeedback } from '@/app/api/sentence/feedback/route'
import type { SentenceHistoryEntry } from '@/app/api/sentence/history/route'
import type { AISentenceHistoryEntry } from '@/app/api/ai-practice/sentence/history/route'

type Tab = 'regular' | 'ai'

// Scores here are on a 0-10 scale, matching the exercise pages themselves.
const THRESHOLDS = { good: 7, ok: 5 }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' · ' + new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

interface HistoryCardProps {
  title: string
  createdAt: string
  score: number
  sentenceText: string | null
  feedback: SentenceFeedback | null
  words?: { text: string; starred: boolean }[]
}

function HistoryCard({ title, createdAt, score, sentenceText, feedback, words }: HistoryCardProps) {
  return (
    <div className="bg-surface rounded-2xl border border-card-border p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-semibold text-fg">{title}</div>
          <div className="text-xs text-fg/40">{formatDate(createdAt)}</div>
        </div>
        <div className={`text-xl font-bold ${scoreColor(score, { thresholds: THRESHOLDS })}`}>{score}/10</div>
      </div>

      {words && words.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {words.map((w, i) => (
            <span
              key={i}
              className={`px-2 py-0.5 rounded-full text-xs border ${
                w.starred
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-black/5 dark:bg-white/5 text-fg/70 border-card-border'
              }`}
            >
              {w.starred ? '★ ' : ''}{w.text}
            </span>
          ))}
        </div>
      )}

      {sentenceText === null ? (
        <p className="text-sm text-fg/40 italic">פרטי הניסיון הזה לא נשמרו</p>
      ) : (
        <>
          <div className="mb-2">
            <p className="text-xs text-fg/40 mb-0.5">המשפט שכתבת</p>
            <p className="text-fg leading-relaxed text-sm">{sentenceText}</p>
          </div>
          {feedback && (
            <>
              <div className="mb-2">
                <p className="text-xs text-fg/40 mb-0.5">משוב</p>
                <p className="text-fg/80 text-sm leading-relaxed">{feedback.feedback}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl p-3">
                <p className="text-xs text-green-700 dark:text-green-400 mb-0.5">גרסה מושלמת</p>
                <p className="text-green-900 dark:text-green-300 text-sm leading-relaxed">{feedback.improved_sentence}</p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function SentenceHistoryPage() {
  const { session } = useStudentSession()
  const [tab, setTab] = useState<Tab>('regular')

  const { data: regularData, loading: regularLoading } = useResource<{ entries: SentenceHistoryEntry[] }>(
    session ? '/api/sentence/history' : null
  )
  const { data: aiData, loading: aiLoading } = useResource<{ entries: AISentenceHistoryEntry[] }>(
    session ? '/api/ai-practice/sentence/history' : null
  )

  const regularEntries = regularData?.entries ?? []
  const aiEntries = aiData?.entries ?? []

  if (regularLoading || aiLoading) return <LoadingSpinner />

  const activeEntries = tab === 'regular' ? regularEntries : aiEntries

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <PageHeader backHref="/sentence" title="ההיסטוריה שלי" subtitle="בניית משפטים" />

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('regular')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === 'regular' ? 'bg-primary-600 text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'
            }`}
          >
            בניית משפט ({regularEntries.length})
          </button>
          <button
            onClick={() => setTab('ai')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === 'ai' ? 'bg-purple-600 text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'
            }`}
          >
            בניית משפט עם AI ({aiEntries.length})
          </button>
        </div>

        {activeEntries.length === 0 ? (
          <p className="text-center text-fg/40 mt-16">עדיין אין ניסיונות שמורים כאן</p>
        ) : (
          <div className="space-y-3">
            {tab === 'regular'
              ? regularEntries.map(entry => {
                  const set = SENTENCE_SETS.find(s => s.id === entry.set_id)
                  const exercise = set?.exercises[entry.exercise_idx]
                  return (
                    <HistoryCard
                      key={entry.id}
                      title={`סט ${entry.set_id}${exercise ? `, תרגיל ${entry.exercise_idx + 1}` : ''}`}
                      createdAt={entry.created_at}
                      score={entry.score}
                      sentenceText={entry.sentence_text}
                      feedback={entry.feedback}
                      words={exercise?.words}
                    />
                  )
                })
              : aiEntries.map(entry => (
                  <HistoryCard
                    key={entry.id}
                    title={`רמה ${entry.level}${entry.word_list?.theme ? ` · ${entry.word_list.theme}` : ''}`}
                    createdAt={entry.created_at}
                    score={entry.score}
                    sentenceText={entry.sentence_text}
                    feedback={entry.feedback}
                    words={entry.word_list?.words}
                  />
                ))}
          </div>
        )}
      </div>
    </div>
  )
}
