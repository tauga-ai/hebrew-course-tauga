import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession, isExpired } from '@/lib/naale/session'
import { pickNextTopic, difficultyLadder, MIN_LEVEL } from '@/lib/naale/leveling'
import { publicFields } from '@/lib/naale/open-grading'
import { selectAll } from '@/lib/naale/paginate'

/** Row shapes for the paginated bank/answer reads below. Spelled out because
 *  selectAll() needs the element type up front, unlike an inline query. */
type BankRow = {
  id: string
  topic: string
  difficulty: number
  prompt: string
  answer_kind: string
  options: string[] | null
  correct_answer: string
}
type OpenBankRow = { id: string; topic: string; difficulty: number; prompt: string; fields: unknown }
type AnsweredRow = { question_id: string; topic: string; answered_at: string }

type PublicQuestion = {
  id: string
  topic: string
  difficulty: number
  // Which content table this came from — naale_questions (mcq) or
  // naale_open_questions (open, AI-graded free text). A topic name only
  // ever exists in one of the two tables, so this never conflicts within
  // one topic's own question pool.
  kind: 'mcq' | 'open'
  prompt: string
  // 'mcq' only:
  answer_kind?: string
  options?: string[] | null
  // Present in the DB row always, but deliberately stripped from `served`
  // below unless debugMode — see that assignment for why.
  correct_answer?: string
  // 'open' only — already stripped of grading-only keys before being sent
  // to the client (see the `served` assignment below), same concern as
  // correct_answer above.
  fields?: Record<string, string>
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
  // separate query per (topic, difficulty) tried — at ~1300 rows this is
  // still cheap to hold in memory, and it turns what could be 15+ sequential
  // round-trips (3 topics x up to 5 levels each) into one. Measured on the
  // remote project: each round-trip here runs 250ms-1000ms, so the original
  // per-level-query version could take 3+ seconds for a single /next call.
  // These three queries are independent of each other, so they run in
  // parallel too.
  // All five paginated: the MCQ bank alone is at PostgREST's 1000-row ceiling,
  // and a silently trimmed bank would quietly shrink the pool this route picks
  // from — a student could be told a topic was finished while questions
  // remained. The answer lists grow for the life of the account.
  const studentId = session.student.id
  const [{ data: levels }, mcqBank, openBank, answered, openAnswered] = await Promise.all([
    db.from('naale_topic_levels').select('topic, level').eq('student_id', studentId),
    selectAll<BankRow>('naale_questions', (from, to) =>
      db.from('naale_questions').select('id, topic, difficulty, prompt, answer_kind, options, correct_answer').range(from, to)),
    selectAll<OpenBankRow>('naale_open_questions', (from, to) =>
      db.from('naale_open_questions').select('id, topic, difficulty, prompt, fields').range(from, to)),
    // Every question this student has ever answered, in any session —
    // "unseen" is lifetime-scoped, not session-scoped.
    selectAll<AnsweredRow>('naale_answers', (from, to) =>
      db.from('naale_answers').select('question_id, topic, answered_at').eq('student_id', studentId).order('answered_at', { ascending: false }).range(from, to)),
    selectAll<AnsweredRow>('naale_open_answers', (from, to) =>
      db.from('naale_open_answers').select('question_id, topic, answered_at').eq('student_id', studentId).order('answered_at', { ascending: false }).range(from, to)),
  ])

  const levelByTopic = new Map<string, number>((levels ?? []).map(l => [l.topic, l.level]))

  // A topic name only ever exists in naale_questions OR naale_open_questions,
  // never both — so merging by topic here can't collide two different
  // question kinds under one key.
  const bankByTopic = new Map<string, PublicQuestion[]>()
  for (const row of mcqBank) {
    if (!bankByTopic.has(row.topic)) bankByTopic.set(row.topic, [])
    bankByTopic.get(row.topic)!.push({ ...row, kind: 'mcq' })
  }
  for (const row of openBank) {
    if (!bankByTopic.has(row.topic)) bankByTopic.set(row.topic, [])
    bankByTopic.get(row.topic)!.push({ id: row.id, topic: row.topic, difficulty: row.difficulty, kind: 'open', prompt: row.prompt, fields: row.fields as Record<string, string> })
  }
  const allTopics = [...bankByTopic.keys()]

  // A topic the student has no level row for yet (added to the bank after
  // they were placed, or before placement ever ran) starts at MIN_LEVEL
  // rather than being invisible to rotation.
  for (const topic of allTopics) {
    if (!levelByTopic.has(topic)) levelByTopic.set(topic, MIN_LEVEL)
  }

  const seenIds = new Set([...answered.map(a => a.question_id), ...openAnswered.map(a => a.question_id)])
  // Whichever answer (mcq or open) is most recent overall decides prevTopic
  // — rotation shouldn't repeat the same topic regardless of which kind the
  // student's last answer happened to be.
  const allAnswered = [...answered, ...openAnswered].sort(
    (a, b) => new Date(b.answered_at).getTime() - new Date(a.answered_at).getTime()
  )
  const prevTopic = allAnswered[0]?.topic ?? null

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
        // For 'open' questions, the same concern applies to grading-only
        // fields (a model answer, anchors) — publicFields() is the allowlist
        // that keeps those server-side, same as correct_answer for 'mcq'.
        served = debugMode
          ? picked
          : picked.kind === 'mcq'
            ? { ...picked, correct_answer: undefined }
            : { ...picked, fields: publicFields(picked.topic, picked.fields!) }
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
