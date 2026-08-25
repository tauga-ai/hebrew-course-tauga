'use client'

import { useState } from 'react'
import { useResource } from '@/lib/hooks/use-resource'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { LevelSteps, topicTone } from '@/components/naale/LevelSteps'
import type { NaaleTopicStat } from '@/lib/naale/stats'
import { t } from '@/lib/dev-i18n'

interface SessionListItem {
  id: string
  kind: string
  started_at: string
  ended_at: string
  completed: boolean
  answered_count: number
}

interface SessionDetail {
  id: string
  completed: boolean
  answered_count: number
  correct_count: number
  xp_earned: number
  coins_earned: number
  topics: NaaleTopicStat[]
  summary_text: string | null
  summary_icon: string | null
}

/**
 * Lets a student open any past session and see that session's own breakdown,
 * alongside the all-time view above it.
 *
 * The end-of-session recap already shows this, but only once and only in the
 * moment the session closes — Noam's ask was that it be reachable later, "to
 * track their progress over time".
 *
 * One session's detail is fetched lazily when it's opened rather than
 * everything up front: a student accumulates sessions all year, and the list
 * is the part they browse. useResource's null-url support does the skipping,
 * and its own cancellation handles a student clicking through several rows
 * faster than the requests return.
 */
export function SessionHistory() {
  const { data, loading, error } = useResource<{ sessions: SessionListItem[] }>('/api/naale/sessions')
  const [openId, setOpenId] = useState<string | null>(null)

  const detail = useResource<SessionDetail>(openId ? `/api/naale/sessions/${openId}` : null)

  if (loading) return (
    <>
      <h2 className="text-sm font-semibold text-fg/70 mb-2 mt-6">{t('היסטוריית תרגולים')}</h2>
      <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-4 space-y-3 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-xl bg-black/5 dark:bg-white/5" />
        ))}
      </div>
    </>
  )
  if (error || !data) return null

  const sessions = data.sessions.filter(s => s.kind === 'practice')

  // Nothing to browse yet — render nothing rather than an empty card telling
  // a brand-new student they have no history, which they already know.
  if (sessions.length === 0) return null

  return (
    <>
      {/* "Practice history" */}
      <h2 className="text-sm font-semibold text-fg/70 mb-2 mt-6">{t('היסטוריית תרגולים')}</h2>
      <div className="bg-surface rounded-2xl shadow-sm border border-card-border overflow-hidden">
        {sessions.map((s, i) => {
          const isOpen = s.id === openId
          return (
            <div key={s.id} className={i > 0 ? 'border-t border-card-border' : ''}>
              <button
                onClick={() => setOpenId(isOpen ? null : s.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 p-4 text-start hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="text-lg shrink-0">{s.completed ? '✅' : '⏸️'}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">
                      <LtrIsolate>{new Date(s.started_at).toLocaleDateString('he-IL')}</LtrIsolate>
                    </span>
                    <span className="block text-xs text-fg/50">
                      <LtrIsolate>{s.answered_count}</LtrIsolate> {t('תרגילים')}
                      {' · '}
                      {s.completed ? t('הושלם') : t('לא הושלם')}
                    </span>
                  </span>
                </span>
                {/* Rotates rather than swapping glyphs, so the control reads
                    as one thing opening rather than two different icons. */}
                <span className={`text-fg/40 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4">
                  {detail.loading && <div className="text-xs text-fg/50 py-2">{t('טוען...')}</div>}
                  {detail.error && (
                    <div className="text-xs text-red-500 dark:text-red-400 py-2">{t('שגיאה בטעינת המידע')}</div>
                  )}
                  {detail.data && <SessionDetailView detail={detail.data} />}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

function SessionDetailView({ detail }: { detail: SessionDetail }) {
  return (
    <>
      {/* Null for every session that ended before the AI summary shipped, and
          for any where the call failed — rendered as absent, not as an empty
          card. */}
      {detail.summary_text && (
        <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3 mb-3 flex items-start gap-2">
          <span className="text-lg shrink-0">{detail.summary_icon ?? '🌟'}</span>
          <p className="text-xs text-fg/80 leading-relaxed">{detail.summary_text}</p>
        </div>
      )}

      <div className="flex gap-4 text-xs text-fg/60 mb-3">
        <span>
          {t('נכונות')} <LtrIsolate>{`${detail.correct_count}/${detail.answered_count}`}</LtrIsolate>
        </span>
        <span>
          <LtrIsolate>{detail.xp_earned}</LtrIsolate> {t('נקודות XP')}
        </span>
        <span>
          <LtrIsolate>{detail.coins_earned}</LtrIsolate> {t('מטבעות')}
        </span>
      </div>

      {/* Same treatment as the all-time skills list above: the level track is
          the only mark and the score is a plain number, rather than two bars
          of equal weight for two different metrics. Scored as correct/answered
          rather than a percentage — a session holds a handful of exercises, so
          "2/3" is honest where "67%" implies a sample it doesn't have. */}
      <div>
        {detail.topics.map((topic, i) => (
          <div
            key={topic.topic}
            className={`grid grid-cols-[1fr_5.5rem_2.5rem] items-center gap-3 py-2 ${
              i > 0 ? 'border-t border-card-border' : ''
            }`}
          >
            <span className="text-xs font-medium text-fg min-w-0 truncate">{topic.topic}</span>
            <LevelSteps
              level={topic.level ?? 1}
              variant="track"
              tone={topicTone(topic.accuracy_pct)}
              label={`${topic.topic} — ${t('רמה')} ${topic.level ?? 1}`}
            />
            <span className="text-xs text-end tabular-nums text-fg/70">
              <LtrIsolate>{`${topic.correct}/${topic.answered}`}</LtrIsolate>
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
