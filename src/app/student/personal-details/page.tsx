'use client'

import { useEffect, useState } from 'react'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { gradeDaparAnswers } from '@/lib/dapar'
import { SENTENCE_SETS } from '@/lib/sentence-exercises'
import type { PracticeSet, Submission } from '@/lib/types'

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
      const [practiceSetsRes, submissionsRes, daparRes, psychoRes, sentenceRes, interviewRes, simRes, tzavRishonRes] = await Promise.all([
        fetch('/api/practice-sets').then(r => r.json()).catch(() => null),
        fetch(`/api/student/${session!.id}/submissions`).then(r => r.json()).catch(() => null),
        fetch('/api/dapar/my-submission').then(r => r.json()).catch(() => null),
        fetch('/api/psychotechnic/my-stats').then(r => r.json()).catch(() => null),
        fetch('/api/sentence/my-stats').then(r => r.json()).catch(() => null),
        fetch('/api/interview/my-stats').then(r => r.json()).catch(() => null),
        fetch('/api/simulation/my-stats').then(r => r.json()).catch(() => null),
        fetch('/api/tzav-rishon/my-stats').then(r => r.json()).catch(() => null),
      ])
      if (cancelled) return

      const totalSets: PracticeSet[] = practiceSetsRes?.sets || []
      const submissions: Submission[] = submissionsRes?.submissions || []
      const avgReading = submissions.length > 0
        ? submissions.reduce((s, sub) => s + sub.score_percentage, 0) / submissions.length
        : null

      const daparGrade = daparRes?.submission?.answers ? gradeDaparAnswers(daparRes.submission.answers) : null

      const lines: StatLine[] = [
        {
          key: 'reading',
          label: 'הבנת הנקרא',
          value: `${submissions.length}/${totalSets.length} סטים${avgReading !== null ? ` · ממוצע ${Math.round(avgReading)}%` : ''}`,
        },
        {
          key: 'dapar',
          label: 'דפ"ר',
          value: daparGrade ? `הוגש · ${Math.round(daparGrade.pct)}%` : 'עדיין לא הוגש',
        },
        {
          key: 'psychotechnic',
          label: 'פסיכוטכני',
          value: `${psychoRes?.attempted_sets ?? 0}/${psychoRes?.total_sets ?? 0} מקבצים${psychoRes?.avg_pct != null ? ` · ממוצע ${Math.round(psychoRes.avg_pct)}%` : ''}`,
        },
        {
          key: 'sentence',
          label: 'בניית משפטים',
          value: `${sentenceRes?.attempted ?? 0}/${SENTENCE_SETS.length} סטים${sentenceRes?.avg_score != null ? ` · ממוצע ${Math.round(sentenceRes.avg_score)}` : ''}`,
        },
        {
          key: 'interview',
          label: 'ראיון אישי',
          value: interviewRes?.count
            ? `${interviewRes.count} ראיונות · ממוצע ${Math.round(interviewRes.avg_score)}${interviewRes.latest_level ? ` · רמה אחרונה ${interviewRes.latest_level}` : ''}`
            : 'עדיין לא בוצע',
        },
        {
          key: 'simulation',
          label: 'סימולציה',
          value: simRes?.completed_count ? `${simRes.completed_count} סימולציות הושלמו` : 'עדיין לא בוצעה',
        },
        {
          key: 'tzav-rishon',
          label: 'דפ״ר לצו ראשון',
          // total comes from the API dynamically (sum across all 4 topics), unlike
          // the two lines above that read a client-side constant's .length — this
          // one has no equivalent constant to import, so it's computed server-side.
          value: `${tzavRishonRes?.attempted ?? 0}/${tzavRishonRes?.total ?? 0} שאלות${tzavRishonRes?.avg_pct != null ? ` · ממוצע ${Math.round(tzavRishonRes.avg_pct)}%` : ''}`,
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
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      setSavedGroup(group)
      retry()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת הכיתה')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <LoadingSpinner />

  const currentGroup = savedGroup ?? session?.lesson_group ?? null

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto">
      <PageHeader backHref="/menu" title="פרטים אישיים" />

      <div className="bg-surface rounded-2xl shadow-md p-6 space-y-4">
        <div>
          <div className="text-xs text-fg/40 mb-0.5">שם מלא</div>
          <div className="font-semibold text-fg">{session?.full_name}</div>
        </div>
        <div>
          <div className="text-xs text-fg/40 mb-0.5">כיתה</div>
          <div className="font-semibold text-fg">{session?.class_name}</div>
        </div>

        {session?.has_lesson_groups && (
          <div>
            <div className="text-xs text-fg/40 mb-2">
              כיתה נוכחית בשיעור {currentGroup && `: כיתה ${currentGroup}`}
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
                  {saving === group ? '...' : `כיתה ${group}`}
                </button>
              ))}
            </div>
            {error && <p className="text-red-500 dark:text-red-400 text-sm text-center mt-2">{error}</p>}
          </div>
        )}
      </div>

      <div className="bg-surface rounded-2xl shadow-md p-6 mt-4">
        <h2 className="text-sm font-semibold text-fg/60 mb-3">הביצועים שלי</h2>
        {stats === null ? (
          <p className="text-sm text-fg/40">טוען...</p>
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
