import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Submit reading answers (part A or B)
async function submitReading(db: ReturnType<typeof createServiceClient>, session_id: string, part: number, answers: { question_id: number; selected_answer: number; is_correct: boolean }[]) {
  const rows = answers.map(a => ({
    session_id,
    question_id: a.question_id,
    selected_answer: a.selected_answer,
    is_correct: a.is_correct,
  }))
  await db.from('simulation_reading_answers').insert(rows)

  const correct = answers.filter(a => a.is_correct).length
  const total = answers.length
  const field = part === 1 ? { part_a_correct: correct } : { part_b_correct: correct }
  await db.from('simulation_sessions').update(field).eq('id', session_id)

  return { correct, total }
}

// Submit sentence results (part C)
async function submitSentences(db: ReturnType<typeof createServiceClient>, session_id: string, results: { ex_order: number; sentence: string; score: number; feedback: string; improved_sentence: string }[]) {
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
  const body = await req.json()
  const { session_id, type } = body
  if (!session_id || !type) return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })

  const db = createServiceClient()

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
