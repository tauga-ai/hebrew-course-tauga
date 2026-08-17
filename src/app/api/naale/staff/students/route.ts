import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireNaaleStaff } from '@/lib/naale/auth'
import { buildTopicStats } from '@/lib/naale/stats'
import { computeRewards } from '@/lib/naale/rewards'

/**
 * All Naale students with their per-topic levels and counts, for staff.
 *
 * Two scoping rules, both server-side:
 *  1. Staff role required — a Naale student calling this would see every
 *     classmate's progress, which the spec explicitly forbids.
 *  2. Naale class only, AND naale_role = 'student' only. Staff must never see
 *     the Druze/Arabic or adult-Russian populations, even though all three
 *     share the students table — and staff must not see themselves/each
 *     other listed as students (they have students rows too, so they can
 *     practice).
 *
 * naale_role is denormalized onto students at provisioning time (see
 * getNaaleSession()) specifically so this filter is a plain column check,
 * not a per-request Admin API email lookup.
 *
 * There is deliberately NO per-counselor/group filtering: the spec resolved
 * that all staff on this track see all Naale students. That differs from the
 * existing teacher dashboard (resolveClassAndGroup() scopes by class AND
 * lesson group) — the omission here is intentional, not an oversight.
 */
export async function GET() {
  const staff = await requireNaaleStaff()
  if (staff.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (staff.status === 'forbidden') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const db = createServiceClient()

  const { data: naaleClass } = await db
    .from('classes')
    .select('id')
    .eq('track', 'naale')
    .maybeSingle()

  if (!naaleClass) return NextResponse.json({ error: 'naale class missing' }, { status: 500 })

  const { data: students } = await db
    .from('students')
    .select('id, full_name, created_at, auth_user_id')
    .eq('class_id', naaleClass.id)
    .eq('naale_role', 'student')

  const { data: bankTopics } = await db.from('naale_questions').select('topic')
  const allTopics = [...new Set((bankTopics ?? []).map(r => r.topic))].sort()

  const studentIds = (students ?? []).map(s => s.id)
  const [{ data: levels }, { data: answers }, { data: sessions }] = await Promise.all([
    db.from('naale_topic_levels').select('student_id, topic, level').in('student_id', studentIds),
    db.from('naale_answers').select('student_id, topic, is_correct, is_review, session_id').in('student_id', studentIds),
    db.from('naale_sessions').select('id, student_id, kind, completed').in('student_id', studentIds),
  ])

  // Review answers (ticket 15) excluded — same working decision as
  // /api/naale/my-stats, so a student's own view and staff's view of them
  // never disagree.
  const nonReviewAnswers = (answers ?? []).filter(a => !a.is_review)

  // Google's profile photo per student, same display-only relay as
  // /api/naale/me — never stored, a missing/failed one just falls back to
  // an initials badge client-side. One admin lookup per student is fine at
  // this cohort's scale (dozens, not thousands).
  const avatarByAuthId = new Map(
    await Promise.all(
      (students ?? []).map(async s => {
        const { data } = await db.auth.admin.getUserById(s.auth_user_id)
        const meta = data?.user?.user_metadata
        const avatarUrl = (meta?.avatar_url as string | undefined) ?? (meta?.picture as string | undefined) ?? null
        return [s.auth_user_id, avatarUrl] as const
      })
    )
  )

  const rows = (students ?? []).map(s => {
    const myLevels = (levels ?? []).filter(l => l.student_id === s.id)
    const myAnswers = nonReviewAnswers.filter(a => a.student_id === s.id)
    const mySessions = (sessions ?? []).filter(x => x.student_id === s.id)

    // XP/coins: same derivation as /api/naale/my-stats — placement answers
    // excluded (calibration, not practice), so a student's own view and
    // staff's view of them never disagree.
    const practiceSessionIds = new Set(mySessions.filter(x => x.kind === 'practice').map(x => x.id))
    const practiceAnswers = myAnswers.filter(a => practiceSessionIds.has(a.session_id))
    const { xp, coins } = computeRewards(practiceAnswers, mySessions)

    return {
      student_id: s.id,
      full_name: s.full_name,
      avatar_url: avatarByAuthId.get(s.auth_user_id) ?? null,
      topics: buildTopicStats(allTopics, myLevels, myAnswers),
      totals: {
        answered: myAnswers.length,
        correct: myAnswers.filter(a => a.is_correct).length,
        sessions: mySessions.length,
        completed_sessions: mySessions.filter(x => x.completed).length,
        xp,
        coins,
      },
    }
  })

  return NextResponse.json({ students: rows })
}
