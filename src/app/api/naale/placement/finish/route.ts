import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession } from '@/lib/naale/session'
import { placementLevel } from '@/lib/naale/leveling'

/**
 * Turns a completed placement into starting levels: for each in-scope topic,
 * correct → level 3, incorrect → level 1, decided independently per topic.
 *
 * All rows are written here in one pass, not incrementally per answer, so an
 * abandoned placement leaves no half-placed profile (and /session/start
 * therefore offers placement again).
 *
 * completed: false on the session — placement is calibration, not a practice
 * session, so it does not count toward the streak / completion minimum
 * (pending Yuval's confirmation — see ticket 11's task.md Phase 0).
 *
 * Safe to call twice: an already-ended session is returned unchanged rather
 * than re-upserted, mirroring /session/end's guard.
 */
export async function POST(req: NextRequest) {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let session_id: string
  try {
    ({ session_id } = await req.json())
  } catch {
    return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 })
  }
  if (!session_id) return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })

  const owned = await loadOwnedSession(session_id, session.student.id)
  if (!owned.ok || owned.session.kind !== 'placement') {
    return NextResponse.json({ error: 'תרגול לא נמצא' }, { status: 404 })
  }
  if (owned.session.ended_at) {
    return NextResponse.json({ placed: 0, already_ended: true })
  }

  const db = createServiceClient()

  const [{ data: placementAnswers }, { data: openPlacementAnswers }, { data: bankTopics }, { data: openBankTopics }] = await Promise.all([
    db.from('naale_answers').select('topic, is_correct').eq('session_id', session_id),
    db.from('naale_open_answers').select('topic, score').eq('session_id', session_id),
    // Every topic in the bank gets a starting level — including any the student
    // somehow didn't see, which default to the easy level rather than being left
    // absent (an absent row is what marks a student as unplaced).
    db.from('naale_questions').select('topic'),
    db.from('naale_open_questions').select('topic'),
  ])

  const correctByTopic = new Map<string, boolean>()
  for (const a of placementAnswers ?? []) correctByTopic.set(a.topic, a.is_correct)
  // A score of 4-5 counts as "correct" for placementLevel() purposes, same
  // threshold used everywhere else a graded score needs a pass/fail read.
  for (const a of openPlacementAnswers ?? []) correctByTopic.set(a.topic, a.score >= 4)

  const allTopics = [...new Set([...(bankTopics ?? []).map(r => r.topic), ...(openBankTopics ?? []).map(r => r.topic)])]

  const rows = allTopics.map(topic => ({
    student_id: session.student.id,
    topic,
    level: placementLevel(correctByTopic.get(topic) ?? false),
    correct_streak: 0,
    wrong_streak: 0,
    answered_count: correctByTopic.has(topic) ? 1 : 0,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await db
    .from('naale_topic_levels')
    .upsert(rows, { onConflict: 'student_id,topic' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db
    .from('naale_sessions')
    .update({ ended_at: new Date().toISOString(), completed: false })
    .eq('id', session_id)

  return NextResponse.json({ placed: rows.length, already_ended: false })
}
