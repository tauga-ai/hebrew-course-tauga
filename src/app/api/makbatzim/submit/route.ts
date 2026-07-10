import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getQuestionById, gradeAnswer, getSetMeta, isSetComplete } from '@/lib/makbatzim'
import { getStudentFromSession } from '@/lib/auth'
import { broadcastClassroomActivity } from '@/lib/realtime-broadcast'

export async function POST(req: NextRequest) {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let set_id, question_id, selected_option
  try {
    ({ set_id, question_id, selected_option } = await req.json())
  } catch {
    return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 })
  }
  if (!set_id || !question_id || !selected_option) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }
  if (!Number.isInteger(selected_option) || selected_option < 1 || selected_option > 4) {
    return NextResponse.json({ error: 'תשובה לא תקינה' }, { status: 400 })
  }

  const question = getQuestionById(set_id, question_id)
  if (!question) return NextResponse.json({ error: 'שאלה לא נמצאה' }, { status: 404 })

  // Server always computes this itself — never trusts a client-supplied result.
  const is_correct = gradeAnswer(question, selected_option)

  const db = createServiceClient()
  const { error } = await db.from('makbatzim_results').upsert(
    {
      student_id: session.student.id,
      class_id: session.student.class_id,
      set_id,
      question_id,
      selected_option,
      is_correct,
      answered_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,set_id,question_id' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const setMeta = getSetMeta(set_id)
  broadcastClassroomActivity({
    studentId: session.student.id,
    studentName: session.student.full_name,
    classId: session.student.class_id,
    lessonGroup: session.student.lesson_group,
    feature: set_id === 'dapar-simulation' ? 'dapar-simulation' : 'makbatzim',
    label: setMeta?.labelHe ?? set_id,
    status: 'in_progress',
    detail: `שאלה ${question_id}: ${is_correct ? 'נכון' : 'טעות'}`,
    at: Date.now(),
  })

  // Exam mode: dapar-simulation never tells the client whether an answer
  // was right, nor what the correct one is, until the whole 40-question set
  // has been answered (checked AFTER this upsert, so answering the last
  // question reveals immediately) — a real server-side boundary, not just
  // a UI choice, since a student could otherwise read the correct answer
  // straight off the Network tab regardless of what the page renders.
  if (set_id === 'dapar-simulation' && !(await isSetComplete(db, session.student.id, set_id))) {
    return NextResponse.json({ recorded: true })
  }

  return NextResponse.json({
    is_correct,
    correct_option: question.correctOption,
    explanation: question.explanation,
  })
}
