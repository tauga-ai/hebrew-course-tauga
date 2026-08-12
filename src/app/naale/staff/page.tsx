'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { useResource } from '@/lib/hooks/use-resource'
import { createClient } from '@/lib/supabase/client'
import { scoreColor } from '@/lib/score-color'
import type { NaaleTopicStat } from '@/lib/naale/stats'
import { t } from '@/lib/dev-i18n'

interface StaffStudent {
  student_id: string
  full_name: string
  topics: NaaleTopicStat[]
  totals: { answered: number; correct: number; sessions: number; completed_sessions: number }
}

interface StaffStudents {
  students: StaffStudent[]
}

/**
 * Every Naale student's progress, for staff. No per-counselor filtering —
 * the spec resolved that all staff see all Naale students regardless of
 * group, unlike the draft-prep teacher dashboard's class+group scoping.
 *
 * Staff also get a "try a practice session" button, reusing the same
 * /session/start -> /naale/session flow students use unchanged — staff have
 * students rows too (so they can practice), but /api/naale/staff/students
 * filters them out via naale_role so they never show up in this list.
 */
export default function NaaleStaffPage() {
  const router = useRouter()
  const { data, loading, error } = useResource<StaffStudents>('/api/naale/staff/students')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/naale/login')
  }

  async function handlePractice() {
    setStarting(true)
    setStartError('')
    try {
      const res = await fetch('/api/naale/session/start', { method: 'POST' })
      const resData = await res.json()
      if (!res.ok) throw new Error(resData.error || 'שגיאה')
      const destination = resData.kind === 'placement' ? '/naale/placement' : '/naale/session'
      router.push(`${destination}?session_id=${resData.session_id}`)
    } catch (err: unknown) {
      setStartError(err instanceof Error ? err.message : 'שגיאה בפתיחת תרגול')
      setStarting(false)
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto w-full">
      <div className="flex justify-between items-center mt-4 mb-6">
        <h1 className="font-bold text-primary-700 dark:text-primary-400">{t('תלמידים')}</h1>
        <button type="button" onClick={handleLogout} className="text-sm text-fg/40 hover:text-fg/70">
          {t('יציאה')}
        </button>
      </div>

      <button
        onClick={handlePractice}
        disabled={starting}
        className="w-full py-3 mb-4 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
      >
        {starting ? t('מתחיל תרגול...') : t('נסה תרגול בעצמך')}
      </button>
      {startError && <p className="text-red-500 dark:text-red-400 text-sm text-center mb-4">{startError}</p>}

      {loading && <LoadingSpinner />}

      {error && <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}

      {data && (
        <div className="bg-surface rounded-2xl shadow-sm border border-card-border divide-y divide-card-border">
          {data.students.length === 0 && (
            <p className="text-fg/50 text-sm text-center p-6">{t('אין עדיין תלמידים')}</p>
          )}
          {data.students.map(s => (
            <div key={s.student_id}>
              <button
                onClick={() => setExpanded(expanded === s.student_id ? null : s.student_id)}
                className="w-full flex justify-between items-center text-sm p-4 hover:bg-black/5 dark:hover:bg-white/5 transition text-right"
              >
                <span className="text-fg font-medium">{s.full_name}</span>
                <span className="text-fg/60 flex items-center gap-2 shrink-0">
                  <LtrIsolate>{`${s.totals.correct}/${s.totals.answered}`}</LtrIsolate>
                  <span className="text-fg/30">{expanded === s.student_id ? '▲' : '▼'}</span>
                </span>
              </button>
              {expanded === s.student_id && (
                <div className="px-4 pb-4 space-y-2">
                  {s.topics.map(topic => (
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
