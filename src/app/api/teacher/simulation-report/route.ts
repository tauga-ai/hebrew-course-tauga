import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'מייל חסר' }, { status: 400 })

  const db = createServiceClient()
  const { data: cls } = await db.from('classes').select('id, name').eq('teacher_email', email).single()
  if (!cls) return NextResponse.json({ error: 'כיתה לא נמצאה' }, { status: 404 })

  const { data: students } = await db.from('students').select('id, full_name').eq('class_id', cls.id)
  const studentIds = students?.map(s => s.id) || []

  if (studentIds.length === 0) {
    return NextResponse.json({ class_name: cls.name, sessions: [], question_stats: [] })
  }

  const { data: sessions } = await db
    .from('simulation_sessions')
    .select('*')
    .in('student_id', studentIds)
    .order('started_at', { ascending: false })

  const sessionIds = sessions?.map(s => s.id) || []

  const { data: readingAnswers } = sessionIds.length > 0
    ? await db.from('simulation_reading_answers').select('session_id, question_id, is_correct').in('session_id', sessionIds)
    : { data: [] }

  const { data: questions } = await db
    .from('simulation_questions')
    .select('id, part, q_order, question_text, passage_text')
    .order('part').order('q_order')

  // Build per-student rows
  const studentMap = Object.fromEntries((students || []).map(s => [s.id, s.full_name]))
  const sessionRows = (sessions || []).map(s => ({
    session_id: s.id,
    student_name: studentMap[s.student_id] || '—',
    status: s.status,
    started_at: s.started_at,
    part_a_correct: s.part_a_correct,
    part_a_total: s.part_a_total || 16,
    part_a_pct: s.part_a_correct != null ? Math.round((s.part_a_correct / (s.part_a_total || 16)) * 100) : null,
    part_b_correct: s.part_b_correct,
    part_b_total: s.part_b_total || 24,
    part_b_pct: s.part_b_correct != null ? Math.round((s.part_b_correct / (s.part_b_total || 24)) * 100) : null,
    part_c_avg: s.part_c_avg_score != null ? Number(s.part_c_avg_score).toFixed(1) : null,
    part_d_score: s.part_d_score,
    part_d_level: s.part_d_level,
  }))

  // Build per-question stats
  const questionStats = (questions || []).map(q => {
    const qAnswers = (readingAnswers || []).filter(a => a.question_id === q.id)
    const correct = qAnswers.filter(a => a.is_correct).length
    return {
      question_id: q.id,
      part: q.part,
      q_order: q.q_order,
      question_text: q.question_text,
      attempts: qAnswers.length,
      correct,
      success_pct: qAnswers.length > 0 ? Math.round((correct / qAnswers.length) * 100) : null,
    }
  }).filter(q => q.attempts > 0)

  return NextResponse.json({
    class_name: cls.name,
    sessions: sessionRows,
    question_stats: questionStats,
  })
}
