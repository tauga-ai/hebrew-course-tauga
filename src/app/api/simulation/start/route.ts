import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { student_id, class_id } = await req.json()
  if (!student_id || !class_id) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }

  const db = createServiceClient()

  // Create session
  const { data: session, error } = await db
    .from('simulation_sessions')
    .insert({ student_id, class_id })
    .select('id')
    .single()

  if (error || !session) {
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
    session_id: session.id,
    part_a: qRes.data?.filter(q => q.part === 1) || [],
    part_b: qRes.data?.filter(q => q.part === 2) || [],
    part_c: exRes.data || [],
  })
}
