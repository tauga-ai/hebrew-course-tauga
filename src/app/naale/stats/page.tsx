'use client'

import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { NaaleSidebar } from '@/components/naale/NaaleSidebar'
import { LevelSteps, topicTone } from '@/components/naale/LevelSteps'
import { SessionHistory } from '@/components/naale/SessionHistory'
import { MistakesHistory } from '@/components/naale/MistakesHistory'
import { MAX_LEVEL } from '@/lib/naale/leveling'
import type { NaaleTopicStat } from '@/lib/naale/stats'
import { t } from '@/lib/dev-i18n'

interface MyStats {
  topics: NaaleTopicStat[]
  totals: { answered: number; correct: number; sessions: number; completed_sessions: number; xp: number; coins: number; streak: number }
}

const ARC_R = 36
const ARC_C = 2 * Math.PI * ARC_R

/**
 * The student's own progress, inside the shared desktop shell (Ticket 17).
 *
 * Built around one question — how far have I come? — with a headline that
 * can't cap out: every topic climbs to MAX_LEVEL, so the ceiling is the whole
 * bank rather than a per-week target, and the number keeps moving all year.
 * An earlier
 * version led with a weekly session goal, which stops meaning anything the
 * moment a student hits it.
 *
 * The ceiling is derived from data.topics — which /api/naale/my-stats builds
 * from the question bank, not from the student's own rows — rather than
 * hardcoded, so a student whose bank only serves five topics reads out of 20
 * without anything here knowing that.
 *
 * Streak, XP and coins stay but sit small beside the headline: they're
 * rewards for showing up, which is a different job from telling a student
 * where they stand.
 */
export default function NaaleStatsPage() {
  const { data, loading, error } = useResource<MyStats>('/api/naale/my-stats')

  let content
  if (loading) {
    content = <LoadingSpinner />
  } else if (error || !data) {
    content = (
      <>
        <PageHeader backHref="/naale" title={t('ההתקדמות שלי')} />
        <p className="text-red-500 dark:text-red-400 text-sm text-center">{error ?? t('שגיאה בטעינת המידע')}</p>
      </>
    )
  } else {
    // Level 1 is where a topic starts, not a level climbed to — counting it
    // would fill the arc to 20% for a student who has done nothing but sit
    // placement. So each topic contributes level-1, and the ceiling is
    // MAX_LEVEL-1 per topic.
    const climbed = data.topics.reduce((n, topic) => n + Math.max((topic.level ?? 1) - 1, 0), 0)
    const ceiling = data.topics.length * (MAX_LEVEL - 1)
    const started = data.topics.some(topic => topic.started)

    content = (
      <>
        <PageHeader backHref="/naale" title={t('ההתקדמות שלי')} />

        {/* HERO — the climb */}
        <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-5 mb-3">
          <div className="flex items-center gap-5 flex-wrap">
            <svg width="86" height="86" viewBox="0 0 86 86" className="shrink-0" aria-hidden>
              <circle cx="43" cy="43" r={ARC_R} fill="none" strokeWidth="9" className="stroke-gray-200 dark:stroke-white/10" />
              {climbed > 0 && (
                <circle
                  cx="43"
                  cy="43"
                  r={ARC_R}
                  fill="none"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={ARC_C}
                  strokeDashoffset={ceiling > 0 ? ARC_C * (1 - climbed / ceiling) : ARC_C}
                  transform="rotate(-90 43 43)"
                  className="stroke-accent-naale transition-all"
                />
              )}
            </svg>

            <div className="flex-1 min-w-[13rem]">
              <div className="text-4xl font-bold text-fg leading-none tabular-nums">
                <LtrIsolate>{String(climbed)}</LtrIsolate>
                <span className="text-lg font-normal text-fg/40">
                  {' / '}
                  <LtrIsolate>{String(ceiling)}</LtrIsolate>
                </span>
              </div>
              <div className="text-sm text-fg/60 mt-1.5">
                {started ? (
                  <>
                    {t('רמות שנצברו')} · <LtrIsolate>{String(data.topics.length)}</LtrIsolate> {t('נושאים')}
                  </>
                ) : (
                  /* Day one is the state every student sees first, and the one
                     a grid of zeroes handles worst — nothing here is a score
                     to feel bad about yet. */
                  t('רמות לטפס — התרגול הראשון שלך יקבע את נקודת הפתיחה')
                )}
              </div>
            </div>

            {started && (
              <div className="flex gap-5 shrink-0 border-s border-card-border ps-5">
                <span>
                  <span className="block text-lg font-bold text-fg tabular-nums leading-tight">
                    🔥 <LtrIsolate>{String(data.totals.streak)}</LtrIsolate>
                  </span>
                  <span className="block text-[0.65rem] font-semibold tracking-wide text-fg/40">{t('רצף')}</span>
                </span>
                <span>
                  <span className="block text-lg font-bold text-fg tabular-nums leading-tight">
                    <LtrIsolate>{String(data.totals.xp)}</LtrIsolate>
                  </span>
                  <span className="block text-[0.65rem] font-semibold tracking-wide text-fg/40">{t('נקודות XP')}</span>
                </span>
                <span>
                  <span className="block text-lg font-bold text-fg tabular-nums leading-tight">
                    <LtrIsolate>{String(data.totals.coins)}</LtrIsolate>
                  </span>
                  <span className="block text-[0.65rem] font-semibold tracking-wide text-fg/40">{t('מטבעות')}</span>
                </span>
              </div>
            )}
          </div>

          {/* All-time counts kept, but as a footnote to the headline rather
              than tiles competing with it. */}
          {started && (
            <div className="flex justify-between items-center text-xs text-fg/50 mt-4 pt-3 border-t border-card-border">
              <span>
                {t('תרגילים שנענו')} <LtrIsolate>{`${data.totals.correct}/${data.totals.answered}`}</LtrIsolate>
              </span>
              <span>
                {t('תרגולים שהושלמו')} <LtrIsolate>{String(data.totals.completed_sessions)}</LtrIsolate>
              </span>
            </div>
          )}
        </div>

        {/* SKILLS — level is the bar, accuracy is ink.
            The old row drew level and accuracy as two marks of equal weight,
            so neither read as the primary one. Now the level is the only
            mark and the accuracy is a plain number beside it. */}
        <h2 className="text-sm font-semibold text-fg/70 mb-2">{t('מיומנויות')}</h2>
        <div className="bg-surface rounded-2xl shadow-sm border border-card-border px-5 py-2">
          {data.topics.map((topic, i) => {
            const tone = topicTone(topic.accuracy_pct)
            return (
              <div
                key={topic.topic}
                className={`grid grid-cols-[1fr_5.5rem_3rem] sm:grid-cols-[1fr_8.5rem_3.5rem] items-center gap-3 py-3 ${
                  i > 0 ? 'border-t border-card-border' : ''
                }`}
              >
                <span className={`text-sm min-w-0 truncate ${topic.started ? 'text-fg' : 'text-fg/40'}`}>
                  {topic.topic}
                  {/* Colour never carries meaning on its own — the weak topic
                      is named as weak, not just tinted. */}
                  {topic.started && tone === 'bad' && (
                    <span className="ms-2 text-[0.7rem] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 whitespace-nowrap">
                      {t('דורש תרגול')}
                    </span>
                  )}
                </span>

                <LevelSteps
                  level={topic.level ?? 1}
                  locked={!topic.started}
                  variant="track"
                  tone={tone}
                  label={
                    topic.started
                      ? `${topic.topic} — ${t('רמה')} ${topic.level ?? 1}/${MAX_LEVEL}`
                      : `${topic.topic} — ${t('לא התחיל')}`
                  }
                />

                <span className={`text-xs text-end tabular-nums ${topic.started ? 'text-fg/70' : 'text-fg/30'}`}>
                  {topic.accuracy_pct === null ? (
                    t('טרם')
                  ) : (
                    <LtrIsolate>{`${Math.round(topic.accuracy_pct)}%`}</LtrIsolate>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        {/* Per-session history, below the all-time view rather than replacing
            it — the ticket keeps the cumulative numbers as this page's
            primary content and adds session-by-session as a second way in. */}
        <SessionHistory />
        <MistakesHistory />
      </>
    )
  }

  return (
    <div className="min-h-screen md:flex">
      <NaaleSidebar role="student" />
      <div className="flex-1 p-4 max-w-5xl mx-auto w-full">{content}</div>
    </div>
  )
}
