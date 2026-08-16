'use client'

import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { NaaleSidebar } from '@/components/naale/NaaleSidebar'
import { LevelSteps } from '@/components/naale/LevelSteps'
import { scoreColor } from '@/lib/score-color'
import type { NaaleTopicStat } from '@/lib/naale/stats'
import { t } from '@/lib/dev-i18n'

interface MyStats {
  topics: NaaleTopicStat[]
  totals: { answered: number; correct: number; sessions: number; completed_sessions: number; xp: number; coins: number; streak: number }
}

/**
 * The student's own progress — now inside the shared desktop shell
 * (Ticket 17). The totals card is kept even though NaaleSidebar now shows
 * streak/XP/coins persistently too: this page's job is the per-topic detail
 * list, so the totals stay as this screen's own summary rather than being
 * dropped in favor of the sidebar's compact version.
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
    content = (
      <>
        <PageHeader backHref="/naale" title={t('ההתקדמות שלי')} />

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-4 text-center">
            <div className="text-2xl">🔥</div>
            <div className="text-2xl font-bold text-fg mt-1"><LtrIsolate>{String(data.totals.streak)}</LtrIsolate></div>
            <div className="text-xs text-fg/50 mt-0.5">{t('שבועות ברצף')}</div>
          </div>
          <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-4 text-center">
            <div className="text-2xl">⭐</div>
            <div className="text-2xl font-bold text-accent-naale mt-1"><LtrIsolate>{String(data.totals.xp)}</LtrIsolate></div>
            <div className="text-xs text-fg/50 mt-0.5">{t('נקודות XP')}</div>
          </div>
          <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-4 text-center">
            <div className="text-2xl">🪙</div>
            <div className="text-2xl font-bold text-fg mt-1"><LtrIsolate>{String(data.totals.coins)}</LtrIsolate></div>
            <div className="text-xs text-fg/50 mt-0.5">{t('מטבעות')}</div>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs text-fg/50 mb-6 px-1">
          <span>
            {t('תרגילים שנענו')} <LtrIsolate>{`${data.totals.correct}/${data.totals.answered}`}</LtrIsolate>
          </span>
          <span>
            {t('תרגולים שהושלמו')} <LtrIsolate>{String(data.totals.completed_sessions)}</LtrIsolate>
          </span>
        </div>

        <h2 className="text-sm font-semibold text-fg/70 mb-2">{t('מיומנויות')}</h2>
        <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 space-y-5">
          {data.topics.map(topic => (
            <div key={topic.topic}>
              <div className="flex justify-between items-center mb-1.5 gap-3">
                <span className="text-sm font-medium text-fg flex-1 min-w-0 truncate">{topic.topic}</span>
                {topic.started ? (
                  <span className="flex items-center gap-2 shrink-0">
                    <LevelSteps level={topic.level ?? 1} />
                    <span className="text-xs text-fg/50">
                      {t('רמה')} <LtrIsolate>{String(topic.level ?? 1)}</LtrIsolate>
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-fg/30 shrink-0">{t('לא התחיל')}</span>
                )}
              </div>

              {topic.started ? (
                <>
                  <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2">
                    <div
                      className="bg-accent-naale h-2 rounded-full transition-all"
                      style={{ width: `${topic.accuracy_pct ?? 0}%` }}
                    />
                  </div>
                  <div className={`text-xs mt-1 text-right ${scoreColor(topic.accuracy_pct)}`}>
                    <LtrIsolate>{`${topic.correct}/${topic.answered}`}</LtrIsolate>
                  </div>
                </>
              ) : (
                <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2 opacity-40" />
              )}
            </div>
          ))}
        </div>
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
