import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getClassAndStudents } from '@/lib/teacher-data'
import { requireTeacher } from '@/lib/auth'

export async function GET() {
  const teacher = await requireTeacher()
  if (teacher.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const result = await getClassAndStudents(db, teacher.email)
  if (!result) return NextResponse.json({ error: 'כיתה לא נמצאה' }, { status: 404 })
  const { students, studentIds } = result

  if (studentIds.length === 0) {
    return NextResponse.json({ sentence_stats: [], interview_stats: [], students: [] })
  }

  const [sentenceRes, interviewRes] = await Promise.all([
    db.from('sentence_results').select('student_id, set_id, score').in('student_id', studentIds),
    db.from('interview_results').select('student_id, score, level, submitted_at').in('student_id', studentIds),
  ])

  const sentenceResults = sentenceRes.data || []
  const interviewResults = interviewRes.data || []

  // Per-set sentence stats (sets 1-9)
  const sentenceBySet: Record<number, number[]> = {}
  for (const r of sentenceResults) {
    if (!sentenceBySet[r.set_id]) sentenceBySet[r.set_id] = []
    sentenceBySet[r.set_id].push(r.score)
  }
  const sentence_stats = Array.from({ length: 9 }, (_, i) => {
    const scores = sentenceBySet[i + 1] || []
    return {
      set_id: i + 1,
      attempts: scores.length,
      avg_score: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    }
  })

  // Interview stats
  const interview_stats = {
    total: interviewResults.length,
    avg_score: interviewResults.length > 0
      ? interviewResults.reduce((a, b) => a + b.score, 0) / interviewResults.length
      : null,
  }

  // Per-student summary
  const studentSummary = (students || []).map(s => {
    const sr = sentenceResults.filter(r => r.student_id === s.id)
    const ir = interviewResults.filter(r => r.student_id === s.id)
    return {
      id: s.id,
      name: s.full_name,
      sentence_attempts: sr.length,
      sentence_avg: sr.length > 0 ? sr.reduce((a, b) => a + b.score, 0) / sr.length : null,
      interview_count: ir.length,
      interview_avg: ir.length > 0 ? ir.reduce((a, b) => a + b.score, 0) / ir.length : null,
    }
  })

  return NextResponse.json({ sentence_stats, interview_stats, students: studentSummary })
}
