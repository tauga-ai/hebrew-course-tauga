import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSetById, gradeAnswers } from '@/lib/psychotechnic'
import { getStudentFromSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { set_id, answers } = await req.json()
  if (!set_id || !answers) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }

  const set = getSetById(set_id)
  if (!set) return NextResponse.json({ error: 'מקבץ לא נמצא' }, { status: 404 })

  const { results, score, total } = gradeAnswers(set, answers)

  const db = createServiceClient()
  const { error } = await db.from('psychotechnic_submissions').insert({
    student_id: session.student.id,
    class_id: session.student.class_id,
    set_id,
    answers,
    score, total,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ results, score, total })
}
