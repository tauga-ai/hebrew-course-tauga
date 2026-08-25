'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { NaaleSidebar } from '@/components/naale/NaaleSidebar'
import { LevelSteps } from '@/components/naale/LevelSteps'
import { Avatar } from '@/components/naale/Avatar'
import { useResource } from '@/lib/hooks/use-resource'
import { scoreColor } from '@/lib/score-color'
import type { NaaleTopicStat } from '@/lib/naale/stats'
import { t } from '@/lib/dev-i18n'

interface StaffStudent {
  student_id: string
  full_name: string
  avatar_url: string | null
  topics: NaaleTopicStat[]
  totals: { answered: number; correct: number; sessions: number; completed_sessions: number; xp: number; coins: number }
  session_dates: string[]
}

interface StaffStudents {
  students: StaffStudent[]
}

// Not a spec number — the "bad" threshold scoreColor() already uses everywhere else
// in the app. Retune here if 50% turns out to be the wrong cutoff for this cohort.
const NEEDS_ATTENTION_THRESHOLD = 50

function overallAccuracy(totals: StaffStudent['totals']): number | null {
  return totals.answered > 0 ? Math.round((totals.correct / totals.answered) * 100) : null
}

const BAR_PALETTE = { good: 'bg-green-500', ok: 'bg-yellow-400', bad: 'bg-red-400' }

function statusLabel(acc: number | null): string {
  if (acc === null) return 'לא התחיל'
  if (acc >= 70) return 'מצוין'
  if (acc >= 50) return 'סביר'
  return 'דורש תשומת לב'
}

function AccuracyBar({ totals }: { totals: StaffStudent['totals'] }) {
  const acc = overallAccuracy(totals)
  if (acc === null) return <span className="text-xs text-fg/30">{t('לא התחיל')}</span>
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 bg-gray-200 dark:bg-white/10 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${scoreColor(acc, { palette: BAR_PALETTE })}`}
          style={{ width: `${acc}%` }}
        />
      </div>
      <span className={`text-xs font-semibold shrink-0 ${scoreColor(acc)}`}>
        <LtrIsolate>{`${acc}%`}</LtrIsolate>
      </span>
    </div>
  )
}

function StudentRow({ s, critical, onSelect }: { s: StaffStudent; critical?: boolean; onSelect: (s: StaffStudent) => void }) {
  const acc = overallAccuracy(s.totals)
  return (
    <tr
      onClick={() => onSelect(s)}
      className={`cursor-pointer transition ${critical
          ? 'bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20'
          : 'hover:bg-black/5 dark:hover:bg-white/5'
        }`}
    >
      <td className="p-3 border-b border-card-border">
        <div className="flex items-center gap-3">
          <Avatar name={s.full_name} avatarUrl={s.avatar_url} />
          <div className="min-w-0">
            <div className="font-medium text-fg truncate">{s.full_name}</div>
            <div className={`text-xs ${scoreColor(acc, { emptyClass: 'text-fg/30' })}`}>{t(statusLabel(acc))}</div>
          </div>
        </div>
      </td>
      <td className="p-3 border-b border-card-border">
        <AccuracyBar totals={s.totals} />
      </td>
      <td className="p-3 text-center border-b border-card-border text-fg/70">
        <LtrIsolate>{s.totals.completed_sessions}</LtrIsolate>
      </td>
      <td className="p-3 text-center border-b border-card-border">
        <span className="text-xs font-medium text-primary-600 dark:text-primary-400 border border-card-border rounded-lg px-2 py-1 whitespace-nowrap">
          {t('הצג')}
        </span>
      </td>
    </tr>
  )
}

const DIALOG_MS = 180

function StudentDialog({ s, onClose }: { s: StaffStudent; onClose: () => void }) {
  const acc = overallAccuracy(s.totals)
  // `open` drives both directions: false on the first paint so the entrance
  // has somewhere to animate FROM, then false again while closing so the exit
  // is visible before the parent unmounts us.
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setOpen(true), 16)
    return () => clearTimeout(id)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setTimeout(onClose, DIALOG_MS)
  }, [onClose])

  // Esc closes through the same path, so it animates out like the X does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={close}
        className={`absolute inset-0 bg-black/90 transition-opacity duration-200 motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div className={`relative w-full max-w-sm max-h-[85vh] bg-surface rounded-2xl shadow-xl overflow-y-auto p-5 transition-all duration-200 motion-reduce:transition-none ${open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={s.full_name} avatarUrl={s.avatar_url} sizeClass="w-10 h-10 text-sm" />
            <div className="min-w-0">
              <div className="font-bold text-fg truncate">{s.full_name}</div>
              <div className={`text-xs ${scoreColor(acc, { emptyClass: 'text-fg/30' })}`}>{t(statusLabel(acc))}</div>
            </div>
          </div>
          <button type="button" onClick={close} className="text-fg/40 hover:text-fg/70 text-xl leading-none shrink-0">
            ×
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-black/5 dark:bg-white/5 rounded-xl p-3 text-center">
            <div className="text-lg">⭐</div>
            <div className="font-bold text-accent-naale mt-0.5"><LtrIsolate>{s.totals.xp}</LtrIsolate></div>
            <div className="text-[10px] text-fg/50 mt-0.5">{t('נקודות XP')}</div>
          </div>
          <div className="bg-black/5 dark:bg-white/5 rounded-xl p-3 text-center">
            <div className="text-lg">🪙</div>
            <div className="font-bold text-fg mt-0.5"><LtrIsolate>{s.totals.coins}</LtrIsolate></div>
            <div className="text-[10px] text-fg/50 mt-0.5">{t('מטבעות')}</div>
          </div>
          <div className="bg-black/5 dark:bg-white/5 rounded-xl p-3 text-center">
            <div className="text-lg">✅</div>
            <div className="font-bold text-fg mt-0.5"><LtrIsolate>{s.totals.completed_sessions}</LtrIsolate></div>
            <div className="text-[10px] text-fg/50 mt-0.5">{t('תרגולים שהושלמו')}</div>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-fg/70 mb-2">{t('מיומנויות')}</h3>
        <div className="space-y-2">
          {s.topics.map(topic => (
            <div key={topic.topic} className="flex justify-between items-center text-sm">
              <span className="text-fg/70 flex-1 min-w-0 truncate">{topic.topic}</span>
              {topic.started ? (
                <span className="flex items-center gap-3 shrink-0">
                  <LevelSteps level={topic.level ?? 1} />
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

        {s.session_dates.length > 0 && (
          <div className="mt-4 bg-black/5 dark:bg-white/5 rounded-xl p-3">
            <p className="text-[10px] text-fg/50 uppercase tracking-wide mb-2">{t('היסטוריית תרגולים')}</p>
            <div className="space-y-2">
              {s.session_dates.map((date, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${i === 0 ? 'bg-accent-naale' : 'bg-accent-naale/40'}`} />
                  <span className="text-xs text-fg/70">
                    <LtrIsolate>{new Date(date).toLocaleDateString('he-IL')}</LtrIsolate>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
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
 *
 * Redesigned from a flat expandable list into a searchable roster table with
 * a "needs attention" section (accuracy below NEEDS_ATTENTION_THRESHOLD,
 * excluding students who haven't answered anything yet — a brand-new cohort
 * would otherwise flag everyone on day one). Table styling mirrors
 * teacher/(protected)/students/page.tsx, the closest existing precedent for
 * a staff-facing roster table in this app. Per-student detail opens in a
 * dialog rather than an inline expand — the topic list can grow to 7 rows as
 * more content ships, which would otherwise push every row below it down the
 * page.
 */
export default function NaaleStaffPage() {
  const router = useRouter()
  const { data, loading, error } = useResource<StaffStudents>('/api/naale/staff/students')
  // Only for the sidebar's admin nav item — staff themselves are gated by
  // requireNaaleStaff() above via /api/naale/staff/students, not this call.
  const { data: me } = useResource<{ is_admin: boolean }>('/api/naale/me')
  const [selected, setSelected] = useState<StaffStudent | null>(null)
  const [search, setSearch] = useState('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')

  const students = useMemo(() => data?.students ?? [], [data])

  const needsAttention = useMemo(
    () =>
      students.filter(s => {
        const acc = overallAccuracy(s.totals)
        return acc !== null && acc < NEEDS_ATTENTION_THRESHOLD
      }),
    [students]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter(s => s.full_name.toLowerCase().includes(q))
  }, [students, search])

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

  useEffect(() => {
    if (!selected) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selected])

  return (
    <div className="min-h-screen md:flex">
      <NaaleSidebar role="staff" showAdminLink={me?.is_admin ?? false} />
      <div className="flex-1 p-4 max-w-5xl mx-auto w-full">
        <div className="flex justify-between items-center mt-4 mb-6 gap-3">
          <h1 className="font-bold text-primary-700 dark:text-primary-400 text-xl">{t('תלמידים')}</h1>
          <button
            onClick={handlePractice}
            disabled={starting}
            className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 whitespace-nowrap"
          >
            {starting ? t('מתחיל תרגול...') : t('נסה תרגול בעצמך')}
          </button>
        </div>
        {startError && <p className="text-red-500 dark:text-red-400 text-sm text-center mb-4">{startError}</p>}

        {loading && <LoadingSpinner />}
        {error && <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}

        {data && (
          <>
            {needsAttention.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                  {t('דורש תשומת לב')} ({needsAttention.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full bg-surface rounded-xl border border-red-200 dark:border-red-500/30 text-sm">
                    <tbody>
                      {needsAttention.map(s => (
                        <StudentRow key={s.student_id} s={s} critical onSelect={setSelected} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('חיפוש תלמיד...')}
              className="w-full mb-4 border border-card-border rounded-lg px-4 py-2 text-sm bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />

            {filtered.length === 0 ? (
              <p className="text-fg/50 text-sm text-center p-6">
                {students.length === 0 ? t('אין עדיין תלמידים') : t('לא נמצאו תלמידים')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full bg-surface rounded-xl border border-card-border text-sm">
                  <thead>
                    <tr className="bg-black/5 dark:bg-white/5 border-b border-card-border">
                      <th className="text-right p-3 font-semibold text-fg/80">{t('תלמיד')}</th>
                      <th className="text-right p-3 font-semibold text-fg/80">{t('דיוק כולל')}</th>
                      <th className="p-3 font-semibold text-fg/80 text-center">{t('תרגולים שהושלמו')}</th>
                      <th className="p-3 w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(s => (
                      <StudentRow key={s.student_id} s={s} onSelect={setSelected} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
      {selected && <StudentDialog s={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
