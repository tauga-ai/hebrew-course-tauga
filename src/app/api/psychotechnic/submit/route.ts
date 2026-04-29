import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getSetById, gradeAnswers } from '@/lib/psychotechnic'

export async function POST(req: NextRequest) {
  const { student_id, class_id, set_id, answers } = await req.json()
  if (!student_id || !class_id || !set_id || !answers) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }

  const set = getSetById(set_id)
  if (!set) return NextResponse.json({ error: 'מקבץ לא נמצא' }, { status: 404 })

  const { results, score, total } = gradeAnswers(set, answers)

  const db = createServiceClient()
  const { error } = await db.from('psychotechnic_submissions').insert({
    student_id, class_id, set_id,
    answers: answers,
    score, total,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ results, score, total })
}
