import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession, isSessionExpired } from '@/lib/naale/session'
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
// session_id is only used by topic-session recycling below, to avoid
// re-picking a question already recycled earlier in THIS session (which
// would violate naale_answers/naale_open_answers' one-row-per-session-question
// uniqueness on the second submit) — unused for practice/placement.
type AnsweredRow = { question_id: string; topic: string; answered_at: string; session_id: string }

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

/**
 * Strips the grading-only fields before a question crosses the wire.
 *
 * `JSON.stringify` omits an explicit `undefined` value, so `correct_answer` is
 * genuinely absent from the response rather than present-and-empty. For 'open'
 * questions the same concern applies to grading-only fields (a model answer,
 * anchors) — publicFields() is the allowlist that keeps those server-side.
 *
 * debugMode is a build-time env-var check, never client-controlled.
 *
 * One helper rather than three inline copies: this route now serves questions
 * from three places (unseen, reclaimed placement, topic-session recycling) and
 * a strip that has to be repeated is a strip that will eventually be forgotten
 * at one of them.
 */
function forClient(q: PublicQuestion): PublicQuestion {
  if (debugMode) return q
  return q.kind === 'mcq'
    ? { ...q, correct_answer: undefined }
    : { ...q, fields: publicFields(q.topic, q.fields!) }
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
  // isSessionExpired, not isExpired(deadline_at): a PAUSED session's deadline is
  // frozen in the past, and answering `done: time_up` to it sent a student
  // arriving from Continue with 277 seconds banked straight to "Time's up! You
  // answered 0 exercises" (observed 2026-08-27).
  if (owned.session.ended_at || isSessionExpired(owned.session)) {
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

  // A topic session serves exactly ONE topic — see the candidate filter below,
  // which discards every other topic before the selection loop runs. Fetching
  // the whole bank first meant downloading four topics' worth of prompts,
  // options and answers to use a quarter of one: 1306 rows to choose among 250.
  // Scoping the query is the same reasoning as the batch fetch above, applied
  // one level further in.
  //
  // Worth more than the row count suggests. The MCQ bank sits at exactly
  // PostgREST's 1000-row page ceiling, so selectAll() pages TWICE — once for
  // the rows, once to learn there is no third page — and each round trip is
  // 250-1000ms against the remote project. A single topic fits in one page.
  // This is felt hardest by exactly the session that can least afford it: three
  // seconds is a tenth of a five-minute exercise.
  //
  // Null for practice/placement, which genuinely rotate across every topic.
  const bankTopic = owned.session.kind === 'topic' ? owned.session.topic : null

  const [{ data: levels }, mcqBank, openBank, answered, openAnswered, placementSessions] = await Promise.all([
    db.from('naale_topic_levels').select('topic, level').eq('student_id', studentId),
    selectAll<BankRow>('naale_questions', (from, to) => {
      const q = db.from('naale_questions').select('id, topic, difficulty, prompt, answer_kind, options, correct_answer')
      return (bankTopic ? q.eq('topic', bankTopic) : q).range(from, to)
    }),
    selectAll<OpenBankRow>('naale_open_questions', (from, to) => {
      const q = db.from('naale_open_questions').select('id, topic, difficulty, prompt, fields')
      return (bankTopic ? q.eq('topic', bankTopic) : q).range(from, to)
    }),
    // Every question this student has ever answered, in any session —
    // "unseen" is lifetime-scoped, not session-scoped.
    selectAll<AnsweredRow>('naale_answers', (from, to) =>
      db.from('naale_answers').select('question_id, topic, answered_at, session_id').eq('student_id', studentId).order('answered_at', { ascending: false }).range(from, to)),
    selectAll<AnsweredRow>('naale_open_answers', (from, to) =>
      db.from('naale_open_answers').select('question_id, topic, answered_at, session_id').eq('student_id', studentId).order('answered_at', { ascending: false }).range(from, to)),
    // Which of this student's sessions were the placement quiz — the answer
    // rows above carry a session_id but not its kind, and placement answers
    // are the ones this route now treats as reclaimable rather than spent
    // (naale-placement-question-recycling).
    selectAll<{ id: string }>('naale_sessions', (from, to) =>
      db.from('naale_sessions').select('id').eq('student_id', studentId).eq('kind', 'placement').range(from, to)),
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

  // "Seen" used to mean every question ever answered, placement included, which
  // permanently spent them: the 30-minute session has no recycling fallback, so
  // a question the placement quiz used was gone for good — and placement serves
  // ABOVE a student's level on purpose, so it was spending the hardest material
  // before the student ever practised it. Noam (2026-08-27): "They should
  // return. Treat them as 'seen' questions (so they go to the back of the queue
  // and won't appear immediately), but don't permanently burn them."
  //
  // So the set splits in two. Answering a question outside placement still
  // spends it exactly as before; answering it ONLY in placement moves it to a
  // second tier that the selection loop reaches only once genuinely unseen
  // material is gone.
  const placementSessionIds = new Set(placementSessions.map(s => s.id))
  const seenIds = new Set<string>()
  const placementFirstSeen = new Map<string, string>()

  for (const a of [...answered, ...openAnswered]) {
    if (placementSessionIds.has(a.session_id)) {
      // Keep the EARLIEST placement answer: the tier below is ordered
      // oldest-first, matching the topic session's existing recycling order so
      // the two read as one rule rather than two.
      const existing = placementFirstSeen.get(a.question_id)
      if (!existing || a.answered_at < existing) placementFirstSeen.set(a.question_id, a.answered_at)
    } else {
      seenIds.add(a.question_id)
    }
  }

  // Answered in placement and never since. A question answered in placement AND
  // later in practice is genuinely seen — this filter is what gives
  // non-placement answers precedence, rather than relying on iteration order.
  const placementOnly = [...placementFirstSeen]
    .filter(([questionId]) => !seenIds.has(questionId))
    .sort((a, b) => (a[1] < b[1] ? -1 : 1))
    .map(([questionId]) => questionId)
  const placementOnlyIds = new Set(placementOnly)
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

  // A topic session is scoped to exactly one topic — no rotation at all.
  // Recycling (below, once this narrowed pool is exhausted) is what replaces
  // "try another topic" for this kind.
  if (owned.session.kind === 'topic' && owned.session.topic) {
    candidates = candidates.filter(t => t === owned.session.topic)
  }

  while (candidates.length > 0) {
    const topic = pickNextTopic(candidates, prevTopic)
    if (!topic) break

    const level = levelByTopic.get(topic) ?? MIN_LEVEL
    const topicQuestions = bankByTopic.get(topic) ?? []
    let served: PublicQuestion | null = null
    let servedIsRecycled = false

    // Pass 1 — genuinely unseen, walking the whole ladder before anything
    // reclaimed is considered.
    for (const difficulty of difficultyLadder(level)) {
      const unseen = topicQuestions.filter(
        q => q.difficulty === difficulty && !seenIds.has(q.id) && !placementOnlyIds.has(q.id)
      )
      if (unseen.length > 0) {
        served = forClient(unseen[Math.floor(Math.random() * unseen.length)])
        break
      }
    }

    // Pass 2 — placement leftovers, oldest first. A SECOND full walk of the
    // ladder rather than a fallback inside pass 1: "back of the queue" has to
    // mean behind every unseen question at any reachable difficulty, not just
    // behind the unseen ones at whichever difficulty happened to be tried
    // first. Deliberately not random, unlike pass 1 — oldest-first matches the
    // topic session's existing recycling order.
    //
    // Never for placement itself: it samples a student cold to find their
    // level, and re-serving a question they have already seen would corrupt
    // the level it produces.
    if (!served && owned.session.kind !== 'placement') {
      const ladder = new Set(difficultyLadder(level))
      const candidate = placementOnly
        .map(id => topicQuestions.find(q => q.id === id))
        .find((q): q is PublicQuestion => !!q && ladder.has(q.difficulty))
      if (candidate) {
        served = forClient(candidate)
        servedIsRecycled = true
      }
    }

    if (served) {
      // Recorded so session/answer and session/open-answer can authorize this
      // exact question outside the normal rules — one late answer once a topic
      // session's timer expires (Timer: soft stop), and an already-answered
      // question re-served by pass 2 above, which the cross-session duplicate
      // check would otherwise reject.
      await db.from('naale_sessions').update({ pending_question_id: served.id }).eq('id', sessionId)

      return NextResponse.json({
        question: served,
        // The level the answer will be judged against, captured now so the
        // answer route records what the question was actually served at.
        level_at_answer: level,
        // Reported for consistency with the topic session's own recycling.
        // Still deliberately unrendered — Noam (2026-08-27), asked whether a
        // student should be told a question is a repeat: "No need to tell them".
        ...(servedIsRecycled ? { is_recycled: true } : {}),
      })
    }

    // Nothing unseen anywhere in this topic — drop it and try another. This
    // is what makes the loop terminate: candidates strictly shrinks each
    // pass.
    candidates = candidates.filter(t => t !== topic)
  }

  // A topic session's own exhaustion fallback: recycle rather than end.
  // Doesn't apply to practice/placement — the spec is explicit for those
  // that repeating a question is not an acceptable fallback; a topic session
  // has nowhere else to rotate to once its one topic runs dry, so recycling
  // is the fallback instead of ending after a handful of questions.
  if (owned.session.kind === 'topic' && owned.session.topic) {
    const topic = owned.session.topic
    const topicAnswered = [...answered, ...openAnswered]
      .filter(a => a.topic === topic && a.session_id !== sessionId)
      .sort((a, b) => new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime())

    const oldest = topicAnswered[0]
    const recycled = oldest ? bankByTopic.get(topic)?.find(q => q.id === oldest.question_id) : null

    if (recycled) {
      const served = forClient(recycled)

      await db.from('naale_sessions').update({ pending_question_id: served.id }).eq('id', sessionId)

      return NextResponse.json({
        question: served,
        level_at_answer: levelByTopic.get(topic) ?? MIN_LEVEL,
        is_recycled: true,
      })
    }
  }

  return NextResponse.json({
    done: true,
    reason: allTopics.length === 0 ? 'no_topics' : 'bank_exhausted',
  })
}
