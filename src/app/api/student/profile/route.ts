import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase'
import { getStudentFromSession } from '@/lib/auth'

/**
 * Returns the authenticated user's student profile (id, full_name, class_id,
 * class_name). Used by the student-session hook instead of localStorage.
 */
export async function GET() {
  const result = await getStudentFromSession()

  if (result.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (result.status === 'no_profile') {
    return NextResponse.json({ error: 'no_profile' }, { status: 404 })
  }

  const db = createServiceClient()
  const { data: cls } = await db
    .from('classes')
    .select('name')
    .eq('id', result.student.class_id)
    .maybeSingle()

  return NextResponse.json({
    id: result.student.id,
    full_name: result.student.full_name,
    class_id: result.student.class_id,
    class_name: cls?.name || '',
  })
}

/**
 * Creates the student profile row for the authenticated user, replacing the
 * old find-or-create-by-name flow. Identity comes ONLY from getUser() —
 * never from the request body. Class is resolved via a class join code,
 * not a raw class_id. Idempotent: if a profile already exists for this
 * auth user, it's returned as-is — class/name can't be self-changed after
 * the fact.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()

  const { data: existing } = await db
    .from('students')
    .select('id, full_name, class_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (existing) {
    const { data: cls } = await db
      .from('classes')
      .select('name')
      .eq('id', existing.class_id)
      .maybeSingle()
    return NextResponse.json({ student: existing, class_name: cls?.name || '' })
  }

  const body = await req.json()
  const full_name = String(body.full_name || '').trim()
  const class_code = String(body.class_code || '').trim().toUpperCase()

  if (!full_name) {
    return NextResponse.json({ error: 'שם מלא נדרש' }, { status: 400 })
  }
  if (!class_code) {
    return NextResponse.json({ error: 'קוד כיתה נדרש' }, { status: 400 })
  }

  const { data: cls } = await db
    .from('classes')
    .select('id, name')
    .eq('join_code', class_code)
    .maybeSingle()

  if (!cls) {
    return NextResponse.json({ error: 'קוד כיתה לא נמצא' }, { status: 404 })
  }

  const { data: student, error } = await db
    .from('students')
    .insert({ full_name, class_id: cls.id, auth_user_id: user.id })
    .select('id, full_name, class_id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ student, class_name: cls.name })
}
