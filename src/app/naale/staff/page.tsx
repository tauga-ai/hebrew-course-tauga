'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { NaaleShell } from '@/components/naale/NaaleShell'
import { Avatar } from '@/components/naale/Avatar'
import { StartSessionSheet } from '@/components/naale/StartSessionSheet'
import { nextSessionKind, type SessionKind } from '@/lib/naale/next-session-kind'
import { useNaaleProfile } from '@/lib/naale/use-naale-profile'
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
    <div className="flex items-center gap-2 min-w-[80px] sm:min-w-[120px]">
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
      <td className="p-2 sm:p-3 border-b border-card-border">
        <div className="flex items-center gap-2 sm:gap-3">
          <Avatar name={s.full_name} avatarUrl={s.avatar_url} />
          <div className="min-w-0">
            <div className="font-medium text-fg truncate">{s.full_name}</div>
            <div className={`text-xs ${scoreColor(acc, { emptyClass: 'text-fg/30' })}`}>{t(statusLabel(acc))}</div>
          </div>
        </div>
      </td>
      <td className="p-2 sm:p-3 border-b border-card-border">
        <AccuracyBar totals={s.totals} />
      </td>
      {/* Least essential of the four columns on a narrow screen — the name,
          accuracy and the action stay; this one only reappears at sm: and up.
          Its <th> below is hidden the same way so the columns stay aligned. */}
      <td className="hidden sm:table-cell p-3 text-center border-b border-card-border text-fg/70">
        <LtrIsolate>{s.totals.completed_sessions}</LtrIsolate>
      </td>
      <td className="p-2 sm:p-3 text-center border-b border-card-border">
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
  // Gates both the page shell (see the `!authorized` return below) and the
  // students fetch — neither is safe to show/fire until this resolves.
  // Mirrors naale/admin/page.tsx's `ready` gate; naale/page.tsx has the same
  // shape too (naale-staff-page-auth-redirect: this page was the one
  // outlier missing it, which let an off-roster/non-staff visitor see the
  // dashboard shell with no data instead of being redirected).
  const [authorized, setAuthorized] = useState(false)
  const { data, loading, error } = useResource<StaffStudents>(
    authorized ? '/api/naale/staff/students' : null
  )
  // Only for the sidebar's admin nav item — staff themselves are gated by
  // requireNaaleStaff() above via /api/naale/staff/students, not this call.
  // Shared with NaaleSidebar (mounted below via NaaleShell), which reads the
  // same cached profile instead of firing its own /api/naale/me.
  const { profile: me, refresh: refreshProfile } = useNaaleProfile('staff')
  const [search, setSearch] = useState('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetKind, setSheetKind] = useState<SessionKind>('practice')
  const [myLang, setMyLang] = useState<'ru' | 'ar'>('ru')
  const practiceButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    async function checkAccess() {
      const res = await fetch('/api/naale/me')
      if (cancelled) return
      if (res.status === 401) { router.replace('/naale/login'); return }
      if (res.status === 403) { router.replace('/naale/not-authorized'); return }
      const data = await res.json()
      if (cancelled) return
      // A roster student (not staff) has no business on this page either —
      // same forbidden outcome requireNaaleStaff() already gives the API.
      if (data.role !== 'staff') { router.replace('/naale/not-authorized'); return }
      setAuthorized(true)
    }
    checkAccess()
    return () => { cancelled = true }
  }, [router])

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

  /**
   * Staff get the same pre-session sheet students do. They are exercising the
   * real flow, and a staff member who taps this commits the same 30 minutes to
   * the same timer — the sheet is the only place that says so.
   *
   * Their own stats and language are fetched here rather than on page load:
   * this is a rarely-used button on a roster screen, so the requests only
   * happen when someone reaches for it.
   */
  async function openPracticeSheet() {
    setStartError('')
    try {
      // refreshProfile() bypasses the shared cache on purpose — this needs
      // the freshest translation_lang, not whatever was cached at page load.
      const [statsRes, freshMe] = await Promise.all([fetch('/api/naale/my-stats'), refreshProfile()])
      if (statsRes.ok) setSheetKind(nextSessionKind((await statsRes.json()).topics))
      if (freshMe?.translation_lang) setMyLang(freshMe.translation_lang)
    } catch {
      // Defaults stand: 'practice' and 'ru' differ from the truth by one line
      // of copy and one preselected chip, neither worth blocking the sheet on.
    }
    setSheetOpen(true)
  }

  function closePracticeSheet() {
    setSheetOpen(false)
    setStartError('')
    practiceButtonRef.current?.focus()
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

  if (!authorized) return <LoadingSpinner />

  return (
    <NaaleShell role="staff" showAdminLink={me?.is_admin ?? false}>
      <div className="flex justify-between items-center mt-4 mb-6 gap-3">
        <h1 className="font-bold text-primary-700 dark:text-primary-400 text-xl">{t('תלמידים')}</h1>
        <button
          ref={practiceButtonRef}
          onClick={openPracticeSheet}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 whitespace-nowrap"
        >
          {starting ? t('מתחיל תרגול...') : t('נסה תרגול בעצמך')}
        </button>
      </div>
      {startError && !sheetOpen && (
        <p className="text-red-500 dark:text-red-400 text-sm text-center mb-4">{startError}</p>
      )}

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
                    <th className="text-right p-2 sm:p-3 font-semibold text-fg/80">{t('תלמיד')}</th>
                    <th className="text-right p-2 sm:p-3 font-semibold text-fg/80">{t('דיוק כולל')}</th>
                    <th className="hidden sm:table-cell p-3 font-semibold text-fg/80 text-center">{t('תרגולים שהושלמו')}</th>
                    <th className="p-2 sm:p-3 w-16" />
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

      {sheetOpen && (
        <StartSessionSheet
          kind={sheetKind}
          lang={myLang}
          starting={starting}
          error={startError}
          onStart={handlePractice}
          onClose={closePracticeSheet}
        />
      )}
    </NaaleShell>
  )
}
