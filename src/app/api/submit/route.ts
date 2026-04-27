import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { student_id, practice_set_id, answers } = await req.json()

  if (!student_id || !practice_set_id || !answers?.length) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }

  const db = createServiceClient()

  // Check not already submitted
  const { data: existing } = await db
    .from('submissions')
    .select('id')
    .eq('student_id', student_id)
    .eq('practice_set_id', practice_set_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'כבר הגשת סט זה' }, { status: 409 })
  }

  // Get correct answers for this set
  const { data: questions } = await db
    .from('questions')
    .select('id, correct_answer_number')
    .eq('practice_set_id', practice_set_id)

  if (!questions?.length) {
    return NextResponse.json({ error: 'שאלות לא נמצאו' }, { status: 404 })
  }

  const correctMap = new Map(questions.map(q => [q.id, q.correct_answer_number]))

  let correct = 0
  const answerRows = answers.map((a: { question_id: number; selected_answer_number: number }) => {
    const isCorrect = correctMap.get(a.question_id) === a.selected_answer_number
    if (isCorrect) correct++
    return {
      question_id: a.question_id,
      selected_answer_number: a.selected_answer_number,
      is_correct: isCorrect,
    }
  })

  const total = questions.length
  const score = (correct / total) * 100

  // Create submission
  const { data: submission, error: subError } = await db
    .from('submissions')
    .insert({
      student_id,
      practice_set_id,
      score_percentage: score,
      correct_count: correct,
      total_questions: total,
    })
    .select()
    .single()

  if (subError) return NextResponse.json({ error: subError.message }, { status: 500 })

  // Save answers
  const { error: ansError } = await db.from('student_answers').insert(
    answerRows.map((a: { question_id: number; selected_answer_number: number; is_correct: boolean }) => ({
      ...a,
      submission_id: submission.id,
    }))
  )

  if (ansError) return NextResponse.json({ error: ansError.message }, { status: 500 })

  return NextResponse.json({
    score_percentage: score,
    correct_count: correct,
    total_questions: total,
  })
}
