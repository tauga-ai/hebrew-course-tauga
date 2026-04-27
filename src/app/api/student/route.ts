import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { full_name, class_id } = await req.json()

  if (!full_name || !class_id) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }

  const db = createServiceClient()

  // Check if class exists
  const { data: cls } = await db.from('classes').select('id, name').eq('id', class_id).single()
  if (!cls) return NextResponse.json({ error: 'כיתה לא נמצאה' }, { status: 404 })

  // Find or create student
  const { data: existing } = await db
    .from('students')
    .select('*')
    .eq('full_name', full_name)
    .eq('class_id', class_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ student: existing, class_name: cls.name })
  }

  const { data: newStudent, error } = await db
    .from('students')
    .insert({ full_name, class_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ student: newStudent, class_name: cls.name })
}
