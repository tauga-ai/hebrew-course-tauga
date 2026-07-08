import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getQuestionById, gradeAnswer } from '@/lib/tzav-rishon'
import { getStudentFromSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { topic, question_id, selected_option } = await req.json()
  if (!topic || !question_id || !selected_option) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }
  if (selected_option < 1 || selected_option > 4) {
    return NextResponse.json({ error: 'תשובה לא תקינה' }, { status: 400 })
  }

  const question = getQuestionById(topic, question_id)
  if (!question) return NextResponse.json({ error: 'שאלה לא נמצאה' }, { status: 404 })

  // Server always computes this itself — never trusts a client-supplied result.
  const is_correct = gradeAnswer(question, selected_option)

  const db = createServiceClient()
  const { error } = await db.from('tzav_rishon_results').upsert(
    {
      student_id: session.student.id,
      class_id: session.student.class_id,
      topic,
      question_id,
      selected_option,
      is_correct,
      answered_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,topic,question_id' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    is_correct,
    correct_option: question.correctOption,
    explanation: question.explanation,
  })
}
