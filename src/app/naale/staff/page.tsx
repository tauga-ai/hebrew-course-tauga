'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { NaaleSidebar } from '@/components/naale/NaaleSidebar'
import { Avatar } from '@/components/naale/Avatar'
import { useResource } from '@/lib/hooks/use-resource'
import { scoreColor } from '@/lib/score-color'
import {
  NEEDS_ATTENTION_THRESHOLD,
  overallAccuracy,
  statusLabel,
  type StaffStudentRow,
} from '@/lib/naale/staff-view'
import { t } from '@/lib/dev-i18n'

interface StaffStudents {
  students: StaffStudentRow[]
}

const BAR_PALETTE = { good: 'bg-green-500', ok: 'bg-yellow-400', bad: 'bg-red-400' }

function AccuracyBar({ totals }: { totals: StaffStudentRow['totals'] }) {
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

/**
 * A roster row. The last cell is a real `<Link>` to the student's detail
 * route, which is also the keyboard path: it was a styled `<span>` inside a
 * click-only `<tr>`, so neither the row nor the affordance was reachable or
 * announced as a control. The row keeps a click handler for the mouse, but
 * `role="button"` is deliberately NOT on the `<tr>` — that strips its row
 * semantics, costing a screen reader the table structure, and a focusable row
 * wrapping a focusable link is nested interactive content.
 */
function StudentRow({ s, critical }: { s: StaffStudentRow; critical?: boolean }) {
  const router = useRouter()
  const acc = overallAccuracy(s.totals)
  const href = `/naale/staff/students/${s.student_id}`

  return (
    <tr
      onClick={() => router.push(href)}
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
        <Link
          href={href}
          onClick={e => e.stopPropagation()}
          aria-label={`${t('הצג')} — ${s.full_name}`}
          className="inline-block text-xs font-medium text-primary-600 dark:text-primary-400 border border-card-border rounded-lg px-2 py-1 whitespace-nowrap transition hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {t('הצג')}
        </Link>
      </td>
    </tr>
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
                        <StudentRow key={s.student_id} s={s} critical />
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
                      <StudentRow key={s.student_id} s={s} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
