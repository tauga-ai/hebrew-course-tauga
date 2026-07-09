import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getClassAndStudents } from '@/lib/teacher-data'
import { requireTeacher } from '@/lib/auth'
import { getQuestionById, TOPICS } from '@/lib/tzav-rishon'
import { buildTeacherReport, type TeacherReportRow } from '@/lib/teacher-report'

interface ResultRow {
  student_id: string
  topic: string
  question_id: number
  selected_option: number
  is_correct: boolean
}

export async function GET(req: NextRequest) {
  const teacher = await requireTeacher()
  if (teacher.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const topicFilter = req.nextUrl.searchParams.get('topic')

  const db = createServiceClient()
  const result = await getClassAndStudents(db, teacher.email)
  if (!result) return NextResponse.json({ error: 'כיתה לא נמצאה' }, { status: 404 })
  const { cls, students, studentIds } = result

  if (studentIds.length === 0) {
    return NextResponse.json({ class_name: cls.name, topics_summary: [], students: [], question_stats: [] })
  }

  let query = db.from('tzav_rishon_results')
    .select('student_id, topic, question_id, selected_option, is_correct')
    .in('student_id', studentIds)

  if (topicFilter) query = query.eq('topic', topicFilter)

  const { data } = await query
  const rows: TeacherReportRow[] = ((data || []) as ResultRow[]).map(r => ({
    student_id: r.student_id,
    entity_id: r.topic,
    question_id: r.question_id,
    selected_option: r.selected_option,
    is_correct: r.is_correct,
  }))

  const studentMap = Object.fromEntries((students || []).map(s => [s.id, s.full_name]))
  const entities = TOPICS.map(t => ({ key: t.key, labelHe: t.labelHe }))

  const report = buildTeacherReport(
    rows, entities, studentMap,
    (topic, questionId) => getQuestionById(topic, questionId)?.correctOption,
    topicFilter || undefined
  )

  return NextResponse.json({
    class_name: cls.name,
    topics_summary: report.entities_summary.map(e => ({ topic: e.entity_id, topic_label_he: e.label_he, attempted_count: e.attempted_count, avg_pct: e.avg_pct })),
    students: report.students.map(s => ({ student_id: s.student_id, student_name: s.student_name, topic: s.entity_id, topic_label_he: s.label_he, correct_count: s.correct_count, total_answered: s.total_answered, pct: s.pct })),
    question_stats: report.question_stats,
  })
}
