import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getSetById, PSYCHOTECHNIC_SETS } from '@/lib/psychotechnic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  const setId = searchParams.get('set_id') ? Number(searchParams.get('set_id')) : null
  if (!email) return NextResponse.json({ error: 'מייל חסר' }, { status: 400 })

  const db = createServiceClient()
  const { data: cls } = await db.from('classes').select('id, name').eq('teacher_email', email).single()
  if (!cls) return NextResponse.json({ error: 'כיתה לא נמצאה' }, { status: 404 })

  const { data: students } = await db.from('students').select('id, full_name').eq('class_id', cls.id)
  const studentIds = students?.map(s => s.id) || []

  if (studentIds.length === 0) {
    return NextResponse.json({ class_name: cls.name, submissions: [], question_stats: [], sets_summary: [] })
  }

  let query = db.from('psychotechnic_submissions')
    .select('*')
    .in('student_id', studentIds)
    .order('submitted_at', { ascending: false })

  if (setId) query = query.eq('set_id', setId)

  const { data: submissions } = await query

  const studentMap = Object.fromEntries((students || []).map(s => [s.id, s.full_name]))

  // Build submission rows
  const rows = (submissions || []).map(s => ({
    id: s.id,
    student_name: studentMap[s.student_id] || '—',
    student_id: s.student_id,
    set_id: s.set_id,
    set_name: PSYCHOTECHNIC_SETS.find(ps => ps.id === s.set_id)?.name || `מקבץ ${s.set_id}`,
    answers: s.answers as number[],
    score: s.score,
    total: s.total,
    pct: Math.round((s.score / s.total) * 100),
    submitted_at: s.submitted_at,
  }))

  // Per-question stats for a specific set
  let questionStats: any[] = []
  if (setId) {
    const set = getSetById(setId)
    const setSubmissions = rows.filter(r => r.set_id === setId)
    if (set) {
      questionStats = set.answers.map((correct, i) => {
        const qNum = i + 1
        const dist = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<number, number>
        let correctCount = 0
        for (const sub of setSubmissions) {
          const ans = (sub.answers as number[])[i]
          if (ans >= 1 && ans <= 4) dist[ans]++
          if (ans === correct) correctCount++
        }
        return {
          question: qNum,
          correct_answer: correct,
          total_answers: setSubmissions.length,
          correct_count: correctCount,
          success_pct: setSubmissions.length > 0 ? Math.round((correctCount / setSubmissions.length) * 100) : null,
          distribution: dist,
        }
      })
    }
  }

  // Sets summary (count and avg per set)
  const setsSummary = PSYCHOTECHNIC_SETS.map(set => {
    const setSubs = rows.filter(r => r.set_id === set.id)
    const avgScore = setSubs.length > 0
      ? Math.round(setSubs.reduce((acc, s) => acc + s.pct, 0) / setSubs.length)
      : null
    return {
      set_id: set.id,
      set_name: set.name,
      submissions_count: setSubs.length,
      avg_pct: avgScore,
    }
  }).filter(s => s.submissions_count > 0)

  return NextResponse.json({
    class_name: cls.name,
    submissions: rows,
    question_stats: questionStats,
    sets_summary: setsSummary,
  })
}
