import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getClassAndStudents } from '@/lib/teacher-data'
import { requireTeacher } from '@/lib/auth'
import { getQuestionById, SETS } from '@/lib/makbatzim'
import { buildTeacherReport, type TeacherReportRow } from '@/lib/teacher-report'

interface ResultRow {
  student_id: string
  set_id: string
  question_id: number
  selected_option: number
  is_correct: boolean
}

export async function GET(req: NextRequest) {
  const teacher = await requireTeacher()
  if (teacher.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const setFilter = req.nextUrl.searchParams.get('set_id')

  const db = createServiceClient()
  const result = await getClassAndStudents(db, teacher.email)
  if (!result) return NextResponse.json({ error: 'כיתה לא נמצאה' }, { status: 404 })
  const { cls, students, studentIds } = result

  if (studentIds.length === 0) {
    return NextResponse.json({ class_name: cls.name, entities_summary: [], students: [], question_stats: [] })
  }

  let query = db.from('makbatzim_results')
    .select('student_id, set_id, question_id, selected_option, is_correct')
    .in('student_id', studentIds)

  if (setFilter) query = query.eq('set_id', setFilter)

  const { data } = await query
  const rows: TeacherReportRow[] = ((data || []) as ResultRow[]).map(r => ({
    student_id: r.student_id,
    entity_id: r.set_id,
    question_id: r.question_id,
    selected_option: r.selected_option,
    is_correct: r.is_correct,
  }))

  const studentMap = Object.fromEntries((students || []).map(s => [s.id, s.full_name]))
  const entities = SETS.map(s => ({ key: s.key, labelHe: s.labelHe }))

  const report = buildTeacherReport(
    rows, entities, studentMap,
    (setId, questionId) => getQuestionById(setId, questionId)?.correctOption,
    setFilter || undefined
  )

  return NextResponse.json({
    class_name: cls.name,
    entities_summary: report.entities_summary,
    students: report.students,
    question_stats: report.question_stats,
  })
}
