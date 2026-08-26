'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { NaaleSidebar } from '@/components/naale/NaaleSidebar'
import { LevelSteps, topicTone } from '@/components/naale/LevelSteps'
import { AttendanceStrip } from '@/components/naale/AttendanceStrip'
import { Avatar } from '@/components/naale/Avatar'
import { useResource } from '@/lib/hooks/use-resource'
import { scoreColor } from '@/lib/score-color'
import { MAX_LEVEL } from '@/lib/naale/leveling'
import { overallAccuracy, statusLabel, type StaffStudentDetail } from '@/lib/naale/staff-view'
import type { NaaleTopicStat } from '@/lib/naale/stats'
import { t } from '@/lib/dev-i18n'

/**
 * One student's progress, for staff.
 *
 * The page answers one question — should I talk to this student, and about
 * what — and the layout is ordered by that rather than by what is easiest to
 * put in a card. The first draft opened with three large tiles holding XP,
 * coins and a session count: the biggest marks on the page carrying the least
 * actionable numbers, with attendance reduced to a one-line list beside them.
 * Those totals are now an inline strip beside the name, and attendance is the
 * page's signature element.
 *
 * useParams() rather than the `params` prop: in Next 16 `params` is a Promise,
 * and unwrapping it in a client component means React.use() for no gain when
 * the hook returns the same value directly.
 */
export default function NaaleStaffStudentPage() {
  const params = useParams<{ studentId: string }>()
  const studentId = params?.studentId ?? null

  const { data, loading, error } = useResource<{ student: StaffStudentDetail }>(
    studentId ? `/api/naale/staff/students/${studentId}` : null
  )

  const s = data?.student ?? null
  const acc = s ? overallAccuracy(s.totals) : null

  // Weakest first, so the top of the list is the conversation to have. Topics
  // with nothing answered sink to the bottom rather than sorting as 0% — "not
  // started" isn't a weakness, it's an absence.
  const topics = useMemo(() => (s ? sortWeakestFirst(s.topics) : []), [s])

  // Read once per render rather than per cell, so every cell in the strip
  // agrees on which day is today.
  const now = useMemo(() => new Date(), [])

  return (
    <div className="min-h-screen md:flex">
      <NaaleSidebar role="staff" />
      <div className="flex-1 p-4 max-w-4xl mx-auto w-full">
        <PageHeader backHref="/naale/staff" />

        {loading && <LoadingSpinner />}
        {error && <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}

        {s && (
          <>
            {/* Identity and totals on one line. The totals are student-facing
                motivation mechanics, so they stay available to staff but stop
                being the largest thing on the page. */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-card-border">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={s.full_name} avatarUrl={s.avatar_url} sizeClass="w-11 h-11 text-sm" />
                <div className="min-w-0">
                  <h1 className="font-bold text-fg truncate">{s.full_name}</h1>
                  <span className={`text-xs ${scoreColor(acc, { emptyClass: 'text-fg/30' })}`}>
                    {t(statusLabel(acc))}
                  </span>
                </div>
              </div>
              <dl className="flex items-baseline gap-4 text-xs text-fg/50 tabular-nums">
                <div className="flex items-baseline gap-1.5">
                  <dd className="font-bold text-base text-accent-naale"><LtrIsolate>{s.totals.xp}</LtrIsolate></dd>
                  <dt>{t('נקודות XP')}</dt>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <dd className="font-bold text-base text-fg"><LtrIsolate>{s.totals.coins}</LtrIsolate></dd>
                  <dt>{t('מטבעות')}</dt>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <dd className="font-bold text-base text-fg"><LtrIsolate>{s.totals.completed_sessions}</LtrIsolate></dd>
                  <dt>{t('תרגולים שהושלמו')}</dt>
                </div>
              </dl>
            </div>

            <div className="space-y-4">
              <AttendanceStrip sessions={s.session_dates} now={now} />

              <section className="bg-surface rounded-2xl shadow-sm border border-card-border p-4">
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-fg/70">{t('מיומנויות')}</h2>
                  <span className="text-[10px] uppercase tracking-wide text-fg/40">{t('לפי חולשה')}</span>
                </div>

                {/* Three separate numbers, not one fraction. "1/1" and "18/24"
                    look alike and mean completely different things — the first
                    is one answered question, which is no evidence at all. The
                    bar's width is the answer count, so thin means "too early to
                    judge" without anyone having to read it. */}
                <div className="grid grid-cols-[1fr_4.5rem_2rem_2rem_3rem] items-center gap-2 text-[10px] uppercase tracking-wide text-fg/40 mb-1">
                  <span>{t('נושא')}</span>
                  <span className="text-center">{t('רמה')}</span>
                  <span className="text-end">{t('נכון')}</span>
                  <span className="text-end">{t('מתוך')}</span>
                  <span />
                </div>

                <div className="divide-y divide-card-border">
                  {topics.map(topic => (
                    <div
                      key={topic.topic}
                      className="grid grid-cols-[1fr_4.5rem_2rem_2rem_3rem] items-center gap-2 py-2 text-sm"
                    >
                      <span className={`min-w-0 truncate ${topic.started ? 'text-fg/80' : 'text-fg/40'}`}>
                        {topic.topic}
                      </span>

                      <span className="flex justify-center">
                        <LevelSteps
                          level={topic.level ?? 1}
                          locked={!topic.started}
                          tone={topicTone(topic.accuracy_pct)}
                          label={
                            topic.started
                              ? `${topic.topic} — ${t('רמה')} ${topic.level ?? 1}/${MAX_LEVEL}`
                              : `${topic.topic} — ${t('לא התחיל')}`
                          }
                        />
                      </span>

                      {topic.started ? (
                        <>
                          <span className="text-end tabular-nums text-fg/80">
                            <LtrIsolate>{topic.correct}</LtrIsolate>
                          </span>
                          <span className="text-end tabular-nums text-fg/50">
                            <LtrIsolate>{topic.answered}</LtrIsolate>
                          </span>
                          <VolumeBar answered={topic.answered} max={maxAnswered(topics)} />
                        </>
                      ) : (
                        <span className="col-span-3 text-xs text-fg/30 text-end">{t('לא התחיל')}</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** How much evidence a topic's numbers rest on, relative to this student's
 *  busiest topic. Not a score — a confidence cue, so a 100% built on one answer
 *  can't pass for a 100% built on twenty. */
function VolumeBar({ answered, max }: { answered: number; max: number }) {
  const pct = max > 0 ? Math.max(8, Math.round((answered / max) * 100)) : 0
  return (
    <span className="block h-1 rounded-full bg-gray-200 dark:bg-white/10" aria-hidden>
      <span className="block h-1 rounded-full bg-fg/30" style={{ width: `${pct}%` }} />
    </span>
  )
}

function maxAnswered(topics: NaaleTopicStat[]): number {
  return topics.reduce((n, tp) => Math.max(n, tp.answered), 0)
}

/** Started topics by ascending accuracy, then by most-answered so a weak topic
 *  with real evidence outranks one with a single wrong answer. Unstarted topics
 *  last. */
function sortWeakestFirst(topics: NaaleTopicStat[]): NaaleTopicStat[] {
  return [...topics].sort((a, b) => {
    if (a.started !== b.started) return a.started ? -1 : 1
    const aAcc = a.accuracy_pct ?? 100
    const bAcc = b.accuracy_pct ?? 100
    if (aAcc !== bAcc) return aAcc - bAcc
    return b.answered - a.answered
  })
}
