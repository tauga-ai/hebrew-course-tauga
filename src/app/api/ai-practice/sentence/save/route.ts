import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentFromSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { level, score } = await req.json()
  if (level === undefined || score === undefined) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }
  const db = createServiceClient()
  const { error } = await db.from('ai_sentence_results').insert({
    student_id: session.student.id,
    class_id: session.student.class_id,
    level,
    score,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
