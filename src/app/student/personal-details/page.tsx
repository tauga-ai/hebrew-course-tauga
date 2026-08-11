'use client'

import { useEffect, useState } from 'react'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { SENTENCE_SETS } from '@/lib/sentence-exercises'
import type { PracticeSet, Submission } from '@/lib/types'
import { t } from '@/lib/dev-i18n'

const GROUPS = [1, 2, 3] as const

interface StatLine {
  key: string
  label: string
  value: string
}

export default function PersonalDetailsPage() {
  const { session, loading, retry } = useStudentSession()
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [savedGroup, setSavedGroup] = useState<number | null>(null)
  const [stats, setStats] = useState<StatLine[] | null>(null)

  useEffect(() => {
    if (!session) return
    let cancelled = false

    async function loadStats() {
      const [practiceSetsRes, submissionsRes, sentenceRes, interviewRes, simRes, tzavRishonRes, makbatzimRes, aiPracticeRes] = await Promise.all([
        fetch('/api/practice-sets').then(r => r.json()).catch(() => null),
        fetch(`/api/student/${session!.id}/submissions`).then(r => r.json()).catch(() => null),
        fetch('/api/sentence/my-stats').then(r => r.json()).catch(() => null),
        fetch('/api/interview/my-stats').then(r => r.json()).catch(() => null),
        fetch('/api/simulation/my-stats').then(r => r.json()).catch(() => null),
        fetch('/api/tzav-rishon/my-stats').then(r => r.json()).catch(() => null),
        fetch('/api/makbatzim/my-stats').then(r => r.json()).catch(() => null),
        fetch('/api/ai-practice/my-stats').then(r => r.json()).catch(() => null),
      ])
      if (cancelled) return

      const totalSets: PracticeSet[] = practiceSetsRes?.sets || []
      const submissions: Submission[] = submissionsRes?.submissions || []
      const avgReading = submissions.length > 0
        ? submissions.reduce((s, sub) => s + sub.score_percentage, 0) / submissions.length
        : null

      const lines: StatLine[] = [
        {
          key: 'reading',
          label: t('הבנת הנקרא'),
          value: `${submissions.length}/${totalSets.length} ${t('סטים')}${avgReading !== null ? ` · ${t('ממוצע')} ${Math.round(avgReading)}%` : ''}`,
        },
        {
          key: 'sentence',
          label: t('בניית משפטים'),
          value: `${sentenceRes?.attempted ?? 0}/${SENTENCE_SETS.length} ${t('סטים')}${sentenceRes?.avg_score != null ? ` · ${t('ממוצע')} ${Math.round(sentenceRes.avg_score)}` : ''}`,
        },
        {
          key: 'interview',
          label: t('ראיון אישי'),
          value: interviewRes?.count
            ? `${interviewRes.count} ${t('ראיונות')} · ${t('ממוצע')} ${Math.round(interviewRes.avg_score)}${interviewRes.latest_level ? ` · ${t('רמה אחרונה')} ${interviewRes.latest_level}` : ''}`
            : t('עדיין לא בוצע'),
        },
        {
          key: 'simulation',
          label: t('סימולציה'),
          value: simRes?.completed_count ? `${simRes.completed_count} ${t('סימולציות הושלמו')}` : t('עדיין לא בוצעה'),
        },
        {
          key: 'tzav-rishon',
          label: t('תרגול עצמי כמותי - עברית וערבית'),
          // total comes from the API dynamically (sum across all 4 topics), unlike
          // the two lines above that read a client-side constant's .length — this
          // one has no equivalent constant to import, so it's computed server-side.
          value: `${tzavRishonRes?.attempted ?? 0}/${tzavRishonRes?.total ?? 0} ${t('שאלות')}${tzavRishonRes?.avg_pct != null ? ` · ${t('ממוצע')} ${Math.round(tzavRishonRes.avg_pct)}%` : ''}`,
        },
        {
          key: 'makbatzim',
          label: t('מקבצים פסיכוטכני'),
          value: `${makbatzimRes?.regular?.attempted ?? 0}/${makbatzimRes?.regular?.total ?? 0} ${t('שאלות')}${makbatzimRes?.regular?.avg_pct != null ? ` · ${t('ממוצע')} ${Math.round(makbatzimRes.regular.avg_pct)}%` : ''}`,
        },
        {
          key: 'dapar-simulation',
          label: t('סימולציה דפ"ר'),
          value: `${makbatzimRes?.dapar?.attempted ?? 0}/${makbatzimRes?.dapar?.total ?? 0} ${t('שאלות')}${makbatzimRes?.dapar?.avg_pct != null ? ` · ${t('ממוצע')} ${Math.round(makbatzimRes.dapar.avg_pct)}%` : ''}`,
        },
        {
          key: 'ai-reading',
          label: t('הבנת הנקרא (AI)'),
          value: aiPracticeRes?.reading?.attempted
            ? `${aiPracticeRes.reading.attempted} ${t('שאלות')} · ${t('ממוצע')} ${Math.round(aiPracticeRes.reading.avg_pct)}%`
            : t('עדיין לא בוצע'),
        },
        {
          key: 'ai-sentence',
          label: t('בניית משפט (AI)'),
          value: aiPracticeRes?.sentence?.attempted
            ? `${aiPracticeRes.sentence.attempted} ${t('תרגילים')} · ${t('ממוצע')} ${Math.round(aiPracticeRes.sentence.avg_score * 10) / 10}`
            : t('עדיין לא בוצע'),
        },
      ]
      setStats(lines)
    }
    loadStats()
    return () => {
      cancelled = true
    }
  }, [session])

  async function changeGroup(group: number) {
    setSaving(group)
    setError('')
    try {
      const res = await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_group: group }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('שגיאה'))
      setSavedGroup(group)
      retry()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('שגיאה בשמירת הכיתה'))
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <LoadingSpinner />

  const currentGroup = savedGroup ?? session?.lesson_group ?? null

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto">
      <PageHeader backHref="/menu" title={t('פרטים אישיים')} />

      <div className="bg-surface rounded-2xl shadow-md p-6 space-y-4">
        <div>
          <div className="text-xs text-fg/40 mb-0.5">{t('שם מלא')}</div>
          <div className="font-semibold text-fg">{session?.full_name}</div>
        </div>
        <div>
          <div className="text-xs text-fg/40 mb-0.5">{t('כיתה')}</div>
          <div className="font-semibold text-fg">{session?.class_name}</div>
        </div>

        {session?.has_lesson_groups && (
          <div>
            <div className="text-xs text-fg/40 mb-2">
              {t('כיתה נוכחית בשיעור')} {currentGroup && `: ${t('כיתה')} ${currentGroup}`}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {GROUPS.map(group => (
                <button
                  key={group}
                  onClick={() => changeGroup(group)}
                  disabled={saving !== null}
                  className={`font-bold py-3 rounded-lg transition disabled:opacity-50 ${
                    currentGroup === group
                      ? 'bg-primary-600 text-white'
                      : 'bg-black/5 dark:bg-white/5 text-fg/80 hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  {saving === group ? '...' : `${t('כיתה')} ${group}`}
                </button>
              ))}
            </div>
            {error && <p className="text-red-500 dark:text-red-400 text-sm text-center mt-2">{error}</p>}
          </div>
        )}
      </div>

      <div className="bg-surface rounded-2xl shadow-md p-6 mt-4">
        <h2 className="text-sm font-semibold text-fg/60 mb-3">{t('הביצועים שלי')}</h2>
        {stats === null ? (
          <p className="text-sm text-fg/40">{t('טוען...')}</p>
        ) : (
          <div className="space-y-3">
            {stats.map(stat => (
              <div key={stat.key} className="flex justify-between items-center text-sm">
                <span className="text-fg/60">{stat.label}</span>
                <span className="font-semibold text-fg">{stat.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
