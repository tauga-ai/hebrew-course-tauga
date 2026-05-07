import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { hashPassword, verifyPassword } from '@/lib/password'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, full_name, password, email, class_id } = body

  if (!full_name || !password) {
    return NextResponse.json({ error: 'שם וסיסמה נדרשים' }, { status: 400 })
  }

  const db = createServiceClient()
  const trimmedName = full_name.trim()

  if (action === 'register') {
    if (!class_id) return NextResponse.json({ error: 'יש לבחור כיתה' }, { status: 400 })

    const { data: cls } = await db.from('classes').select('id, name').eq('id', class_id).single()
    if (!cls) return NextResponse.json({ error: 'כיתה לא נמצאה' }, { status: 404 })

    // Check if a student with this name already exists in this class
    const { data: existing } = await db
      .from('students')
      .select('id, password_hash')
      .eq('full_name', trimmedName)
      .eq('class_id', class_id)
      .maybeSingle()

    if (existing?.password_hash) {
      return NextResponse.json({ error: 'תלמיד עם שם זה כבר רשום. אנא התחבר.' }, { status: 409 })
    }

    const password_hash = hashPassword(password)

    if (existing) {
      // Existing student without password — set password and email now
      const { data: updated, error } = await db
        .from('students')
        .update({ password_hash, email: email?.trim() || null })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ student: updated, class_name: cls.name })
    }

    const { data: newStudent, error } = await db
      .from('students')
      .insert({ full_name: trimmedName, class_id, password_hash, email: email?.trim() || null })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ student: newStudent, class_name: cls.name })
  }

  // action === 'login' (or default)
  const { data: student } = await db
    .from('students')
    .select('id, full_name, class_id, password_hash')
    .eq('full_name', trimmedName)
    .maybeSingle()

  if (!student) {
    return NextResponse.json({ error: 'תלמיד לא נמצא. אנא הירשם תחילה.' }, { status: 404 })
  }
  if (!student.password_hash) {
    return NextResponse.json({ error: 'עליך להירשם תחילה כדי להגדיר סיסמה.' }, { status: 401 })
  }
  if (!verifyPassword(password, student.password_hash)) {
    return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 401 })
  }

  const { data: cls } = await db.from('classes').select('name').eq('id', student.class_id).single()

  return NextResponse.json({
    student: { id: student.id, full_name: student.full_name, class_id: student.class_id },
    class_name: cls?.name || '',
  })
}
