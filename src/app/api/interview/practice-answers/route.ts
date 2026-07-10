import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentFromSession } from '@/lib/auth'

/** The authenticated student's own saved answers for the free interview-practice tool. */
export async function GET() {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('interview_practice_answers')
    .select('question_id, answer_text')
    .eq('student_id', session.student.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const answers: Record<number, string> = {}
  for (const row of data || []) answers[row.question_id] = row.answer_text

  return NextResponse.json({ answers })
}

/** Upserts one question's answer — re-answering the same question updates it in place. */
export async function POST(req: NextRequest) {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let question_id, answer_text
  try {
    ({ question_id, answer_text } = await req.json())
  } catch {
    return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 })
  }
  if (question_id === undefined || !answer_text) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db.from('interview_practice_answers').upsert(
    {
      student_id: session.student.id,
      class_id: session.student.class_id,
      question_id,
      answer_text,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,question_id' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
