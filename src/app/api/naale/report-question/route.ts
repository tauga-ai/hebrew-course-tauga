import { NextRequest, NextResponse, after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { GRADED_CORRECT_SCORE } from '@/lib/naale/stats'
import {
  REPORT_NOTE_MAX_LENGTH,
  REPORT_RATE_LIMIT,
  REPORT_RATE_WINDOW_MINUTES,
} from '@/lib/naale/question-reports'
import { notifyQuestionReport } from '@/lib/naale/question-reports-notify'

/**
 * A student reporting a mistake in a question (N4).
 *
 * The client sends only three things: which question, which session, and what
 * they want to say. Everything else on the stored report — topic, difficulty,
 * the human-readable question id, the prompt text, the student's own answer —
 * is looked up server-side. A client-supplied topic or prompt would be a
 * report about whatever the client felt like claiming, which is worthless as
 * an incident record.
 *
 * The question may live in either bank, so both are checked. A topic name only
 * ever exists in one of the two, and the ids are uuids, so a hit in both is
 * impossible in practice; the mcq branch simply wins if it ever happened.
 */
export async function POST(req: NextRequest) {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let question_id: string, session_id: string | null, note: string
  try {
    ({ question_id, session_id = null, note } = await req.json())
  } catch {
    return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 })
  }

  if (!question_id || !note?.trim()) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }
  const trimmedNote = note.trim()
  if (trimmedNote.length > REPORT_NOTE_MAX_LENGTH) {
    return NextResponse.json({ error: 'הדיווח ארוך מדי' }, { status: 400 })
  }

  const db = createServiceClient()
  const studentId = session.student.id

  // Rate limit before doing any other work — the point is to make a flood
  // cheap to reject, and this is an open text field aimed at three inboxes.
  const windowStart = new Date(Date.now() - REPORT_RATE_WINDOW_MINUTES * 60_000).toISOString()
  const { count: recentCount } = await db
    .from('naale_question_reports')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .gte('created_at', windowStart)

  if ((recentCount ?? 0) >= REPORT_RATE_LIMIT) {
    return NextResponse.json(
      { error: 'שלחתם דיווחים רבים מדי, נסו שוב מאוחר יותר', code: 'rate_limited' },
      { status: 429 }
    )
  }

  const [{ data: mcqQuestion }, { data: openQuestion }] = await Promise.all([
    db.from('naale_questions').select('id, question_id, topic, difficulty, prompt').eq('id', question_id).maybeSingle(),
    db.from('naale_open_questions').select('id, question_id, topic, difficulty, prompt').eq('id', question_id).maybeSingle(),
  ])

  const question = mcqQuestion ?? openQuestion
  if (!question) return NextResponse.json({ error: 'שאלה לא נמצאה' }, { status: 404 })
  const kind = mcqQuestion ? 'mcq' : 'open'

  // Their own answer, if they already gave one in this session — usually the
  // quickest way for a content editor to see what actually confused them.
  // Scoped to this student, so a session_id from another student's session
  // yields nothing rather than leaking their answer.
  //
  // Asymmetric on purpose: naale_answers stores only whether the answer was
  // correct, never which option was chosen, so there is no MCQ answer text in
  // this system to capture. student_was_correct is the field that means the
  // same thing for both banks.
  let studentAnswer: string | null = null
  let studentWasCorrect: boolean | null = null
  if (session_id) {
    if (kind === 'mcq') {
      const { data } = await db
        .from('naale_answers')
        .select('is_correct')
        .eq('student_id', studentId)
        .eq('session_id', session_id)
        .eq('question_id', question_id)
        .maybeSingle()
      studentWasCorrect = data?.is_correct ?? null
    } else {
      const { data } = await db
        .from('naale_open_answers')
        .select('user_text, score')
        .eq('student_id', studentId)
        .eq('session_id', session_id)
        .eq('question_id', question_id)
        .maybeSingle()
      studentAnswer = data?.user_text ?? null
      studentWasCorrect = data ? data.score >= GRADED_CORRECT_SCORE : null
    }
  }

  const { data: inserted, error } = await db
    .from('naale_question_reports')
    .insert({
      student_id: studentId,
      session_id,
      question_kind: kind,
      question_row_id: question.id,
      question_id: question.question_id,
      topic: question.topic,
      difficulty: question.difficulty,
      prompt_snapshot: question.prompt,
      student_answer: studentAnswer,
      student_was_correct: studentWasCorrect,
      note: trimmedNote,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? 'שמירת הדיווח נכשלה' }, { status: 500 })
  }

  // After the insert, deliberately: the report is safe in the table before
  // anyone is told about it, so a broken notification can never cost a report.
  // Scheduled via after() rather than awaited (would slow the student's
  // response) or fired bare (a serverless function can freeze before an
  // un-awaited promise settles) — after() keeps the function alive until the
  // send finishes without blocking the response.
  after(() =>
    notifyQuestionReport({
      reportId: inserted.id,
      questionId: question.question_id,
      topic: question.topic,
      note: trimmedNote,
    })
  )

  return NextResponse.json({ ok: true, report_id: inserted.id })
}
