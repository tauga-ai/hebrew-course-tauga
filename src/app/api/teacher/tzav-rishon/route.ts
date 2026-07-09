import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getClassAndStudents } from '@/lib/teacher-data'
import { requireTeacher } from '@/lib/auth'
import { getQuestionById, getTopicMeta, TOPICS } from '@/lib/tzav-rishon'

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
  const rows = (data || []) as ResultRow[]

  const studentMap = Object.fromEntries((students || []).map(s => [s.id, s.full_name]))

  // Topics summary: activity + accuracy per topic, across the whole class.
  const topicsSummary = TOPICS.map(t => {
    const topicRows = rows.filter(r => r.topic === t.key)
    return {
      topic: t.key,
      topic_label_he: t.labelHe,
      attempted_count: topicRows.length,
      avg_pct: topicRows.length > 0
        ? Math.round((topicRows.filter(r => r.is_correct).length / topicRows.length) * 100)
        : null,
    }
  }).filter(t => t.attempted_count > 0)

  // Per-student-per-topic summary (not raw per-question rows).
  const studentTopicKey = (studentId: string, topic: string) => `${studentId}::${topic}`
  const studentTopicMap = new Map<string, { correct: number; total: number }>()
  for (const r of rows) {
    const key = studentTopicKey(r.student_id, r.topic)
    const entry = studentTopicMap.get(key) || { correct: 0, total: 0 }
    entry.total++
    if (r.is_correct) entry.correct++
    studentTopicMap.set(key, entry)
  }
  const studentsSummary = Array.from(studentTopicMap.entries()).map(([key, { correct, total }]) => {
    const [studentId, topic] = key.split('::')
    return {
      student_id: studentId,
      student_name: studentMap[studentId] || '—',
      topic,
      topic_label_he: getTopicMeta(topic)?.labelHe || topic,
      correct_count: correct,
      total_answered: total,
      pct: Math.round((correct / total) * 100),
    }
  })

  // Per-question distribution, only computed for a specific topic (avoids
  // mixing question numbers across topics, which would be meaningless).
  let questionStats: {
    question_id: number
    correct_answer: number
    total_answers: number
    correct_count: number
    success_pct: number | null
    distribution: Record<number, number>
  }[] = []
  if (topicFilter) {
    const byQuestion = new Map<number, ResultRow[]>()
    for (const r of rows) {
      if (r.topic !== topicFilter) continue
      const list = byQuestion.get(r.question_id) || []
      list.push(r)
      byQuestion.set(r.question_id, list)
    }
    questionStats = Array.from(byQuestion.entries()).map(([questionId, qRows]) => {
      const question = getQuestionById(topicFilter, questionId)
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
    topics_summary: topicsSummary,
    students: studentsSummary,
    question_stats: questionStats,
  })
}
