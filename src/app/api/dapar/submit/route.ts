import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getStudentFromSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let answers
  try {
    ({ answers } = await req.json())
  } catch {
    return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 })
  }
  if (!answers) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }
  const db = createServiceClient()
  const { error } = await db.from('dapar_submissions').insert({
    student_id: session.student.id,
    class_id: session.student.class_id,
    answers,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
