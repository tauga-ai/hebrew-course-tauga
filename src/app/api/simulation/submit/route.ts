import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getStudentFromSession } from '@/lib/auth'

type ReadingAnswer = { question_id: number; selected_answer: number }
type SentenceResult = { ex_order: number; sentence: string; score: number; feedback: string; improved_sentence: string }

// Submit reading answers (part A or B). Correctness is recomputed here from
// simulation_questions.correct_answer — the client's is_correct is ignored,
// since it was only ever a client-side convenience value, not a grade.
async function submitReading(db: ReturnType<typeof createServiceClient>, session_id: string, part: number, answers: ReadingAnswer[]) {
  const questionIds = answers.map(a => a.question_id)
  const { data: questions } = await db
    .from('simulation_questions')
    .select('id, correct_answer')
    .in('id', questionIds)
  const correctMap = new Map((questions || []).map(q => [q.id, q.correct_answer]))

  const rows = answers.map(a => ({
    session_id,
    question_id: a.question_id,
    selected_answer: a.selected_answer,
    is_correct: correctMap.get(a.question_id) === a.selected_answer,
  }))
  await db.from('simulation_reading_answers').insert(rows)

  const correct = rows.filter(r => r.is_correct).length
  const total = rows.length
  const field = part === 1 ? { part_a_correct: correct } : { part_b_correct: correct }
  await db.from('simulation_sessions').update(field).eq('id', session_id)

  return { correct, total }
}

// Submit sentence results (part C)
async function submitSentences(db: ReturnType<typeof createServiceClient>, session_id: string, results: SentenceResult[]) {
  await db.from('simulation_sentence_results').insert(results.map(r => ({ session_id, ...r })))
  const avg = results.reduce((s, r) => s + r.score, 0) / results.length
  await db.from('simulation_sessions').update({ part_c_avg_score: avg }).eq('id', session_id)
}

// Submit interview result (part D) + mark completed
async function submitInterview(db: ReturnType<typeof createServiceClient>, session_id: string, score: number, level: string, summary: string) {
  await db.from('simulation_interview_results').insert({ session_id, score, level, summary })
  await db.from('simulation_sessions').update({
    part_d_score: score,
    part_d_level: level,
    status: 'completed',
    completed_at: new Date().toISOString(),
  }).eq('id', session_id)
}

export async function POST(req: NextRequest) {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = await req.json()
  const { session_id, type } = body
  if (!session_id || !type) return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })

  const db = createServiceClient()

  // Ownership: this simulation session must belong to the caller — otherwise
  // any authenticated student could submit into anyone else's session.
  const { data: simSession } = await db
    .from('simulation_sessions')
    .select('student_id')
    .eq('id', session_id)
    .maybeSingle()

  if (!simSession || simSession.student_id !== session.student.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    if (type === 'reading_a' || type === 'reading_b') {
      const part = type === 'reading_a' ? 1 : 2
      const result = await submitReading(db, session_id, part, body.answers)
      return NextResponse.json(result)
    }
    if (type === 'sentences') {
      await submitSentences(db, session_id, body.results)
      return NextResponse.json({ ok: true })
    }
    if (type === 'interview') {
      await submitInterview(db, session_id, body.score, body.level, body.summary || '')
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'סוג לא ידוע' }, { status: 400 })
  } catch (err) {
    console.error('Simulation submit error:', err)
    return NextResponse.json({ error: 'שגיאה' }, { status: 500 })
  }
}
