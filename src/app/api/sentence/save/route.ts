import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentFromSession } from '@/lib/auth'
import { broadcastClassroomActivity } from '@/lib/realtime-broadcast'

export async function POST(req: NextRequest) {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { set_id, exercise_idx, score } = await req.json()
  if (set_id === undefined || score === undefined) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }
  const db = createServiceClient()
  const { error } = await db.from('sentence_results').insert({
    student_id: session.student.id,
    set_id,
    exercise_idx,
    score,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  broadcastClassroomActivity({
    studentId: session.student.id,
    studentName: session.student.full_name,
    classId: session.student.class_id,
    lessonGroup: session.student.lesson_group,
    feature: 'sentence',
    label: `סט ${set_id}`,
    status: 'in_progress',
    detail: `ציון ${score}/10`,
    at: Date.now(),
  })

  return NextResponse.json({ ok: true })
}
