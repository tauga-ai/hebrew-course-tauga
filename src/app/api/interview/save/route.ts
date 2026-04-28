import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { student_id, score, level } = await req.json()
  if (!student_id || score === undefined) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }
  const db = createServiceClient()
  const { error } = await db.from('interview_results').insert({ student_id, score, level })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
