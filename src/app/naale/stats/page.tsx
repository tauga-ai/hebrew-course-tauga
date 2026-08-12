'use client'

import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { scoreColor } from '@/lib/score-color'
import type { NaaleTopicStat } from '@/lib/naale/stats'
import { t } from '@/lib/dev-i18n'

interface MyStats {
  topics: NaaleTopicStat[]
  totals: { answered: number; correct: number; sessions: number; completed_sessions: number }
}

/** The student's own progress. No sidebar, matching /student/personal-details. */
export default function NaaleStatsPage() {
  const { data, loading, error } = useResource<MyStats>('/api/naale/my-stats')

  if (loading) return <LoadingSpinner />

  if (error || !data) {
    return (
      <div className="min-h-screen p-4 max-w-md mx-auto w-full">
        <PageHeader backHref="/naale" title={t('ההתקדמות שלי')} />
        <p className="text-red-500 dark:text-red-400 text-sm text-center">{error ?? t('שגיאה בטעינת המידע')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto w-full">
      <PageHeader backHref="/naale" title={t('ההתקדמות שלי')} />

      <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 mb-4">
        <div className="flex justify-between items-center text-sm mb-2">
          <span className="text-fg/60">{t('תרגילים שנענו')}</span>
          <span className="font-semibold text-fg"><LtrIsolate>{`${data.totals.correct}/${data.totals.answered}`}</LtrIsolate></span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-fg/60">{t('תרגולים שהושלמו')}</span>
          <span className="font-semibold text-fg"><LtrIsolate>{String(data.totals.completed_sessions)}</LtrIsolate></span>
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
    </div>
  )
}
