import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { DAPAR_CORRECT_ANSWERS, DAPAR_SECTIONS as SECTIONS, DAPAR_TOTAL } from '@/lib/dapar'

const TOTAL = DAPAR_TOTAL

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
    return NextResponse.json({ class_name: cls.name, submissions: [], question_stats: [], section_stats: [] })
  }

  const { data: subs } = await db.from('dapar_submissions')
    .select('*')
    .in('student_id', studentIds)
    .order('submitted_at', { ascending: false })

  const studentMap = Object.fromEntries((students || []).map(s => [s.id, s.full_name]))

  const rows = (subs || []).map(s => {
    const answers = s.answers as number[]
    const score = answers.filter((a: number, i: number) => a === DAPAR_CORRECT_ANSWERS[i]).length
    return {
      id: s.id,
      student_name: studentMap[s.student_id] || '—',
      student_id: s.student_id,
      answers,
      score,
      total: TOTAL,
      pct: Math.round((score / TOTAL) * 100),
      submitted_at: s.submitted_at,
    }
  })

  // Per-question stats
  const questionStats = DAPAR_CORRECT_ANSWERS.map((correct, i) => {
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
    let correctCount = 0
    for (const sub of rows) {
      const ans = sub.answers[i]
      if (ans >= 1 && ans <= 4) dist[ans]++
      if (ans === correct) correctCount++
    }
    return {
      question: i + 1,
      correct_answer: correct,
      total_answers: rows.length,
      correct_count: correctCount,
      success_pct: rows.length > 0 ? Math.round((correctCount / rows.length) * 100) : null,
      distribution: dist,
    }
  })

  // Per-section stats
  const sectionStats = SECTIONS.map(section => {
    let totalCorrect = 0
    let totalAnswered = 0
    for (const sub of rows) {
      for (let j = section.from - 1; j < section.to; j++) {
        if (sub.answers[j] > 0) {
          totalAnswered++
          if (sub.answers[j] === DAPAR_CORRECT_ANSWERS[j]) totalCorrect++
        }
      }
    }
    return {
      label: section.label,
      avg_pct: totalAnswered > 0 ? Math.round((totalCorrect / (rows.length * 10)) * 100) : null,
      total_correct: totalCorrect,
      submissions: rows.length,
    }
  })

  return NextResponse.json({ class_name: cls.name, submissions: rows, question_stats: questionStats, section_stats: sectionStats })
}
