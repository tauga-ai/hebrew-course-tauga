'use client'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { NaaleShell } from '@/components/naale/NaaleShell'
import { useResource } from '@/lib/hooks/use-resource'
import { t } from '@/lib/dev-i18n'

interface DashboardData {
  total_responses: number
  quality_distribution: number[]
  interface_distribution: number[]
  weekly_trend: { week: string; avg_quality: number; avg_interface: number }[]
  suggestions: { created_at: string; question_quality: number; interface_rating: number; suggestions: string | null }[]
}

function RatingDistribution({ title, counts }: { title: string; counts: number[] }) {
  const max = Math.max(1, ...counts)
  const total = counts.reduce((a, b) => a + b, 0)
  return (
    <div className="bg-surface rounded-2xl border border-card-border p-5">
      <h3 className="text-sm font-semibold text-fg/70 mb-3">{title}</h3>
      <div className="space-y-2">
        {counts.map((count, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-4 text-xs text-fg/60 shrink-0"><LtrIsolate>{i + 1}</LtrIsolate></span>
            <div className="flex-1 h-4 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-600 transition-all"
                style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }}
              />
            </div>
            <span className="w-8 text-xs text-fg/60 text-right shrink-0"><LtrIsolate>{count}</LtrIsolate></span>
          </div>
        ))}
      </div>
      {/* "N responses" */}
      <p className="text-xs text-fg/40 mt-3"><LtrIsolate>{total}</LtrIsolate> {t('תגובות')}</p>
    </div>
  )
}

function WeeklyTrend({ weeks }: { weeks: DashboardData['weekly_trend'] }) {
  return (
    <div className="bg-surface rounded-2xl border border-card-border p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        {/* "Weekly trend" */}
        <h3 className="text-sm font-semibold text-fg/70">{t('מגמה שבועית')}</h3>
        <div className="flex items-center gap-3 text-xs text-fg/60">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-600" />
            {t('איכות שאלות')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-naale" />
            {t('ממשק')}
          </span>
        </div>
      </div>
      {weeks.length === 0 ? (
        <p className="text-center text-fg/50 py-6 text-sm">{t('אין עדיין מספיק נתונים')}</p>
      ) : (
        <div className="flex items-end gap-3 h-32">
          {weeks.map(w => (
            <div key={w.week} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <div className="w-full flex items-end justify-center gap-1 h-24">
                <div
                  className="w-2.5 rounded-t-sm bg-primary-600"
                  style={{ height: `${(w.avg_quality / 5) * 100}%` }}
                  title={String(w.avg_quality)}
                />
                <div
                  className="w-2.5 rounded-t-sm bg-accent-naale"
                  style={{ height: `${(w.avg_interface / 5) * 100}%` }}
                  title={String(w.avg_interface)}
                />
              </div>
              <span className="text-[10px] text-fg/40 truncate w-full text-center">
                <LtrIsolate>{new Date(w.week).toLocaleDateString('he-IL', { month: 'short', day: 'numeric' })}</LtrIsolate>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NaaleAdminSessionFeedbackPage() {
  const { data, loading, error } = useResource<DashboardData>('/api/naale/admin/session-feedback')

  return (
    <NaaleShell role="admin" contentClassName="max-w-4xl">
      <h1 className="font-bold text-primary-700 dark:text-primary-400 text-xl mt-4 mb-6">
        {/* "Practice feedback" */}
        {t('משוב על תרגול')}
      </h1>

      {error && <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}
      {loading && <LoadingSpinner />}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RatingDistribution title={t('התפלגות - איכות שאלות')} counts={data.quality_distribution} />
            <RatingDistribution title={t('התפלגות - ממשק')} counts={data.interface_distribution} />
          </div>

          <WeeklyTrend weeks={data.weekly_trend} />

          <div className="bg-surface rounded-2xl border border-card-border p-5">
            {/* "Suggestions" */}
            <h3 className="text-sm font-semibold text-fg/70 mb-3">{t('הצעות מהתלמידים')}</h3>
            {data.suggestions.length === 0 ? (
              <p className="text-center text-fg/50 py-6 text-sm">{t('אין הצעות עדיין')}</p>
            ) : (
              <div className="space-y-3">
                {data.suggestions.map((s, i) => (
                  <div key={i} className="rounded-xl bg-black/5 dark:bg-white/5 p-3">
                    <p className="text-fg whitespace-pre-line text-right mb-1">{s.suggestions}</p>
                    <p className="text-xs text-fg/40 text-right">
                      <LtrIsolate>{s.question_quality}</LtrIsolate>/5 · <LtrIsolate>{s.interface_rating}</LtrIsolate>/5 ·{' '}
                      <LtrIsolate>{new Date(s.created_at).toLocaleDateString('he-IL')}</LtrIsolate>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </NaaleShell>
  )
}
