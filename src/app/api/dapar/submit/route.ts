import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { student_id, class_id, answers } = await req.json()
  if (!student_id || !class_id || !answers) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }
  const db = createServiceClient()
  const { error } = await db.from('dapar_submissions').insert({ student_id, class_id, answers })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
