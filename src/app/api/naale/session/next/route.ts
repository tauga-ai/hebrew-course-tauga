import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession, isExpired } from '@/lib/naale/session'
import { pickNextTopic, difficultyLadder, MIN_LEVEL } from '@/lib/naale/leveling'

type PublicQuestion = {
  id: string
  topic: string
  difficulty: number
  prompt: string
  answer_kind: string
  options: string[] | null
}

/**
 * The next question for an in-progress session.
 *
 * Picks a random topic other than the previous question's topic, then walks
 * that topic's difficulty ladder (current level, then one harder, then
 * progressively easier) for a question this student has never answered. A
 * topic with nothing unseen left at ANY level is marked exhausted and
 * excluded from rotation — the spec is explicit that repeating a question is
 * not an acceptable fallback.
 *
 * The response deliberately omits correct_answer: grading is server-side
 * only (see the answer route), so the answer must never reach the browser.
 */
export async function GET(req: NextRequest) {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })

  const owned = await loadOwnedSession(sessionId, session.student.id)
  if (!owned.ok) return NextResponse.json({ error: 'תרגול לא נמצא' }, { status: 404 })

  // Re-checked server-side: a client polling past its own timer must not get
  // another question.
  if (owned.session.ended_at || isExpired(owned.session.deadline_at)) {
    return NextResponse.json({ done: true, reason: 'time_up' })
  }

  const db = createServiceClient()

  const { data: levels } = await db
    .from('naale_topic_levels')
    .select('topic, level')
    .eq('student_id', session.student.id)

  const levelByTopic = new Map<string, number>((levels ?? []).map(l => [l.topic, l.level]))

  // A topic the student has no level row for yet (added to the bank after
  // they were placed, or before placement ever ran) starts at MIN_LEVEL
  // rather than being invisible to rotation.
  const { data: bankTopics } = await db.from('naale_questions').select('topic')
  const allTopics = [...new Set((bankTopics ?? []).map(r => r.topic))]
  for (const topic of allTopics) {
    if (!levelByTopic.has(topic)) levelByTopic.set(topic, MIN_LEVEL)
  }

  // Every question this student has ever answered, in any session — "unseen"
  // is lifetime-scoped, not session-scoped.
  const { data: answered } = await db
    .from('naale_answers')
    .select('question_id, topic, answered_at')
    .eq('student_id', session.student.id)
    .order('answered_at', { ascending: false })

  const seenIds = new Set((answered ?? []).map(a => a.question_id))
  const prevTopic = answered?.[0]?.topic ?? null

  // Candidate pool starts as every topic in the bank. Topics are removed as
  // they're found exhausted, and exclusion happens BEFORE rotation picks —
  // otherwise rotation could land on an empty topic and end the session
  // early.
  let candidates = [...levelByTopic.keys()]

  while (candidates.length > 0) {
    const topic = pickNextTopic(candidates, prevTopic)
    if (!topic) break

    const level = levelByTopic.get(topic) ?? MIN_LEVEL
    let served: PublicQuestion | null = null

    for (const difficulty of difficultyLadder(level)) {
      // NOTE: correct_answer is deliberately NOT selected.
      const { data: pool } = await db
        .from('naale_questions')
        .select('id, topic, difficulty, prompt, answer_kind, options')
        .eq('topic', topic)
        .eq('difficulty', difficulty)

      const unseen = (pool ?? []).filter(q => !seenIds.has(q.id))
      if (unseen.length > 0) {
        served = unseen[Math.floor(Math.random() * unseen.length)] as PublicQuestion
        break
      }
    }

    if (served) {
      return NextResponse.json({
        question: served,
        // The level the answer will be judged against, captured now so the
        // answer route records what the question was actually served at.
        level_at_answer: level,
      })
    }

    // Nothing unseen anywhere in this topic — drop it and try another. This
    // is what makes the loop terminate: candidates strictly shrinks each
    // pass.
    candidates = candidates.filter(t => t !== topic)
  }

  return NextResponse.json({
    done: true,
    reason: allTopics.length === 0 ? 'no_topics' : 'bank_exhausted',
  })
}
