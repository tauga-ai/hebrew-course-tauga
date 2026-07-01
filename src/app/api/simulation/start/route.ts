import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getStudentFromSession } from '@/lib/auth'

export async function POST() {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()

  // Create session
  const { data: simSession, error } = await db
    .from('simulation_sessions')
    .insert({ student_id: session.student.id, class_id: session.student.class_id })
    .select('id')
    .single()

  if (error || !simSession) {
    return NextResponse.json({ error: error?.message || 'שגיאה' }, { status: 500 })
  }

  // Load all questions + exercises
  const [qRes, exRes] = await Promise.all([
    db.from('simulation_questions')
      .select('*')
      .order('part')
      .order('q_order'),
    db.from('simulation_sentence_exercises')
      .select('*')
      .order('ex_order'),
  ])

  return NextResponse.json({
    session_id: simSession.id,
    part_a: qRes.data?.filter(q => q.part === 1) || [],
    part_b: qRes.data?.filter(q => q.part === 2) || [],
    part_c: exRes.data || [],
  })
}
