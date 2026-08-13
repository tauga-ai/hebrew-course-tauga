'use client'

import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { NaaleSidebar } from '@/components/naale/NaaleSidebar'
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

        <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 mb-4">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-fg/60">{t('תרגילים שנענו')}</span>
            <span className="font-semibold text-fg"><LtrIsolate>{`${data.totals.correct}/${data.totals.answered}`}</LtrIsolate></span>
          </div>
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-fg/60">{t('תרגולים שהושלמו')}</span>
            <span className="font-semibold text-fg"><LtrIsolate>{String(data.totals.completed_sessions)}</LtrIsolate></span>
          </div>
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-fg/60">⭐ {t('נקודות XP')}</span>
            <span className="font-semibold text-fg"><LtrIsolate>{String(data.totals.xp)}</LtrIsolate></span>
          </div>
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-fg/60">🪙 {t('מטבעות')}</span>
            <span className="font-semibold text-fg"><LtrIsolate>{String(data.totals.coins)}</LtrIsolate></span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-fg/60">🔥 {t('שבועות ברצף')}</span>
            <span className="font-semibold text-fg"><LtrIsolate>{String(data.totals.streak)}</LtrIsolate></span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 space-y-3">
          {data.topics.map(topic => (
            <div key={topic.topic} className="flex justify-between items-center text-sm">
              <span className="text-fg/70 flex-1 min-w-0 truncate">{topic.topic}</span>
              {topic.started ? (
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-fg/50 text-xs">
                    {t('רמה')} <LtrIsolate>{String(topic.level ?? 1)}</LtrIsolate>
                  </span>
                  <span className={`font-semibold ${scoreColor(topic.accuracy_pct)}`}>
                    <LtrIsolate>{`${topic.correct}/${topic.answered}`}</LtrIsolate>
                  </span>
                </span>
              ) : (
                <span className="text-fg/30 text-xs shrink-0">{t('לא התחיל')}</span>
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
