import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getClassAndStudents } from '@/lib/teacher-data'
import { requireTeacher } from '@/lib/auth'

export async function GET() {
  const teacher = await requireTeacher()
  if (teacher.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()

  const result = await getClassAndStudents(db, teacher.email)
  if (!result) return NextResponse.json({ error: 'כיתה לא נמצאה' }, { status: 404 })
  const { cls, students, studentIds } = result

  const { data: sets } = await db.from('practice_sets').select('*').order('set_number')

  const { data: submissions } = studentIds.length > 0
    ? await db.from('submissions').select('*').in('student_id', studentIds)
    : { data: [] }

  const studentRows = (students || []).map(st => {
    const stSubs = (submissions || []).filter(s => s.student_id === st.id)
    const setScores = stSubs.map(s => ({
      set_number: (sets || []).find(ps => ps.id === s.practice_set_id)?.set_number || 0,
      score_percentage: s.score_percentage,
    }))
    const avg = setScores.length > 0
      ? setScores.reduce((a, b) => a + b.score_percentage, 0) / setScores.length
      : null
    return {
      student_id: st.id,
      full_name: st.full_name,
      sets: setScores,
      overall_avg: avg,
    }
  })

  const setHeaders = (sets || []).map(s => ({ set_number: s.set_number, topic: s.topic }))

  return NextResponse.json({ class_name: cls.name, students: studentRows, set_headers: setHeaders })
}
