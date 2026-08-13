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
  // Present in the DB row always, but deliberately stripped from `served`
  // below unless debugMode — see that assignment for why.
  correct_answer?: string
}

// Dev-only QA hint (src/components/dev/DevPanel.tsx lets a tester toggle
// whether to actually display it). Gated on NEXT_PUBLIC_DEBUG_MODE alone,
// never on anything client-supplied — a cookie/header can be forged, this
// is baked into the build.
const debugMode = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'

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
 * The response omits correct_answer in production: grading is server-side
 * only (see the answer route), so the answer must never reach the browser.
 * In development only, it's included so the dev QA hint toggle has
 * something to show — see SELECT_FIELDS above.
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

  // The whole bank fetched ONCE and filtered in memory below, rather than a
  // separate query per (topic, difficulty) tried — with ~164 rows total this
  // is trivial to hold in memory, and it turns what could be 15+ sequential
  // round-trips (3 topics x up to 5 levels each) into one. Measured on the
  // remote project: each round-trip here runs 250ms-1000ms, so the original
  // per-level-query version could take 3+ seconds for a single /next call.
  // These three queries are independent of each other, so they run in
  // parallel too.
  const [{ data: levels }, { data: bank }, { data: answered }] = await Promise.all([
    db.from('naale_topic_levels').select('topic, level').eq('student_id', session.student.id),
    db.from('naale_questions').select('id, topic, difficulty, prompt, answer_kind, options, correct_answer'),
    // Every question this student has ever answered, in any session —
    // "unseen" is lifetime-scoped, not session-scoped.
    db.from('naale_answers').select('question_id, topic, answered_at').eq('student_id', session.student.id).order('answered_at', { ascending: false }),
  ])

  const levelByTopic = new Map<string, number>((levels ?? []).map(l => [l.topic, l.level]))

  const bankByTopic = new Map<string, PublicQuestion[]>()
  for (const row of bank ?? []) {
    if (!bankByTopic.has(row.topic)) bankByTopic.set(row.topic, [])
    bankByTopic.get(row.topic)!.push(row)
  }
  const allTopics = [...bankByTopic.keys()]

  // A topic the student has no level row for yet (added to the bank after
  // they were placed, or before placement ever ran) starts at MIN_LEVEL
  // rather than being invisible to rotation.
  for (const topic of allTopics) {
    if (!levelByTopic.has(topic)) levelByTopic.set(topic, MIN_LEVEL)
  }

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
    const topicQuestions = bankByTopic.get(topic) ?? []
    let served: PublicQuestion | null = null

    for (const difficulty of difficultyLadder(level)) {
      const unseen = topicQuestions.filter(q => q.difficulty === difficulty && !seenIds.has(q.id))
      if (unseen.length > 0) {
        const picked = unseen[Math.floor(Math.random() * unseen.length)]
        // Stripped in production: JSON.stringify omits an explicit `undefined`
        // value, so the key is genuinely absent from the response, not just
        // empty. debugMode is a build-time env-var check, never client-controlled.
        served = debugMode ? picked : { ...picked, correct_answer: undefined }
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
