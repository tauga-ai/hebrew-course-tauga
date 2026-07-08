import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getClassAndStudents } from '@/lib/teacher-data'
import { requireTeacher } from '@/lib/auth'
import { getQuestionById, getSetMeta, SETS } from '@/lib/makbatzim'

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
    return NextResponse.json({ class_name: cls.name, sets_summary: [], students: [], question_stats: [] })
  }

  let query = db.from('makbatzim_results')
    .select('student_id, set_id, question_id, selected_option, is_correct')
    .in('student_id', studentIds)

  if (setFilter) query = query.eq('set_id', setFilter)

  const { data } = await query
  const rows = (data || []) as ResultRow[]

  const studentMap = Object.fromEntries((students || []).map(s => [s.id, s.full_name]))

  // Sets summary: activity + accuracy per set, across the whole class.
  const setsSummary = SETS.map(s => {
    const setRows = rows.filter(r => r.set_id === s.key)
    return {
      set_id: s.key,
      set_label_he: s.labelHe,
      attempted_count: setRows.length,
      avg_pct: setRows.length > 0
        ? Math.round((setRows.filter(r => r.is_correct).length / setRows.length) * 100)
        : null,
    }
  }).filter(s => s.attempted_count > 0)

  // Per-student-per-set summary (not raw per-question rows).
  const studentSetKey = (studentId: string, setId: string) => `${studentId}::${setId}`
  const studentSetMap = new Map<string, { correct: number; total: number }>()
  for (const r of rows) {
    const key = studentSetKey(r.student_id, r.set_id)
    const entry = studentSetMap.get(key) || { correct: 0, total: 0 }
    entry.total++
    if (r.is_correct) entry.correct++
    studentSetMap.set(key, entry)
  }
  const studentsSummary = Array.from(studentSetMap.entries()).map(([key, { correct, total }]) => {
    const [studentId, setId] = key.split('::')
    return {
      student_id: studentId,
      student_name: studentMap[studentId] || '—',
      set_id: setId,
      set_label_he: getSetMeta(setId)?.labelHe || setId,
      correct_count: correct,
      total_answered: total,
      pct: Math.round((correct / total) * 100),
    }
  })

  // Per-question distribution, only computed for a specific set (avoids
  // mixing question numbers across sets, which would be meaningless).
  let questionStats: {
    question_id: number
    correct_answer: number
    total_answers: number
    correct_count: number
    success_pct: number | null
    distribution: Record<number, number>
  }[] = []
  if (setFilter) {
    const byQuestion = new Map<number, ResultRow[]>()
    for (const r of rows) {
      if (r.set_id !== setFilter) continue
      const list = byQuestion.get(r.question_id) || []
      list.push(r)
      byQuestion.set(r.question_id, list)
    }
    questionStats = Array.from(byQuestion.entries()).map(([questionId, qRows]) => {
      const question = getQuestionById(setFilter, questionId)
      const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      let correctCount = 0
      for (const r of qRows) {
        if (r.selected_option >= 1 && r.selected_option <= 4) dist[r.selected_option]++
        if (r.is_correct) correctCount++
      }
      return {
        question_id: questionId,
        correct_answer: question?.correctOption ?? 0,
        total_answers: qRows.length,
        correct_count: correctCount,
        success_pct: qRows.length > 0 ? Math.round((correctCount / qRows.length) * 100) : null,
        distribution: dist,
      }
    }).sort((a, b) => a.question_id - b.question_id)
  }

  return NextResponse.json({
    class_name: cls.name,
    sets_summary: setsSummary,
    students: studentsSummary,
    question_stats: questionStats,
  })
}
