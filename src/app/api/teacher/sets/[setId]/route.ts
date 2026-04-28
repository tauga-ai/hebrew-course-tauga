import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'מייל חסר' }, { status: 400 })

  const db = createServiceClient()

  // Verify teacher owns this class
  const { data: cls } = await db.from('classes').select('id, name').eq('teacher_email', email).single()
  if (!cls) return NextResponse.json({ error: 'כיתה לא נמצאה' }, { status: 404 })

  // Get practice set info
  const { data: practiceSet } = await db
    .from('practice_sets')
    .select('*')
    .eq('id', setId)
    .single()
  if (!practiceSet) return NextResponse.json({ error: 'סט לא נמצא' }, { status: 404 })

  // Get all questions for this set
  const { data: questions } = await db
    .from('questions')
    .select('*')
    .eq('practice_set_id', setId)
    .order('question_order')

  // Get all students in this class
  const { data: students } = await db
    .from('students')
    .select('id')
    .eq('class_id', cls.id)
  const studentIds = students?.map(s => s.id) || []

  // Get all submissions for this set from class students
  const { data: submissions } = studentIds.length > 0
    ? await db
        .from('submissions')
        .select('id, score_percentage')
        .eq('practice_set_id', setId)
        .in('student_id', studentIds)
    : { data: [] }

  const submissionIds = submissions?.map(s => s.id) || []
  const totalSubmissions = submissions?.length || 0

  // Get all student answers for these submissions
  const { data: allAnswers } = submissionIds.length > 0
    ? await db
        .from('student_answers')
        .select('question_id, selected_answer_number, is_correct')
        .in('submission_id', submissionIds)
    : { data: [] }

  // Build per-question analytics
  const questionAnalytics = (questions || []).map(q => {
    const qAnswers = (allAnswers || []).filter(a => a.question_id === q.id)
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0 }
    for (const a of qAnswers) {
      if (a.selected_answer_number in dist) {
        dist[a.selected_answer_number as 1 | 2 | 3 | 4]++
      }
    }
    const correctCount = qAnswers.filter(a => a.is_correct).length
    return {
      id: q.id,
      question_order: q.question_order,
      question_text: q.question_text,
      options: [
        q.answer_option_1,
        q.answer_option_2,
        q.answer_option_3,
        q.answer_option_4,
      ],
      correct_answer_number: q.correct_answer_number,
      answer_distribution: dist,
      correct_count: correctCount,
      total_answers: qAnswers.length,
    }
  })

  const avgScore = totalSubmissions > 0
    ? (submissions || []).reduce((s, sub) => s + sub.score_percentage, 0) / totalSubmissions
    : null

  return NextResponse.json({
    practice_set: practiceSet,
    class_name: cls.name,
    total_submissions: totalSubmissions,
    avg_score: avgScore,
    questions: questionAnalytics,
  })
}
