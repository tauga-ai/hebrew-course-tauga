import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getClassAndStudents } from '@/lib/teacher-data'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'מייל חסר' }, { status: 400 })

  const db = createServiceClient()

  const result = await getClassAndStudents(db, email)
  if (!result) return NextResponse.json({ error: 'כיתה לא נמצאה' }, { status: 404 })
  const { cls, studentIds } = result

  // Get all practice sets
  const { data: sets } = await db.from('practice_sets').select('*').order('set_number')

  // Get all submissions for students in this class
  const { data: submissions } = studentIds.length > 0
    ? await db.from('submissions').select('*').in('student_id', studentIds)
    : { data: [] }

  const stats = (sets || []).map(set => {
    const setSubmissions = (submissions || []).filter(s => s.practice_set_id === set.id)
    const scores = setSubmissions.map(s => s.score_percentage)
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
    return {
      set_id: set.id,
      set_number: set.set_number,
      topic: set.topic,
      difficulty_level: set.difficulty_level,
      student_count: setSubmissions.length,
      avg_score: avg,
    }
  })

  return NextResponse.json({ class_name: cls.name, stats })
}
