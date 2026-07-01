import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getStudentFromSession } from '@/lib/auth'

// The [studentId] path segment is kept for URL compatibility with existing
// callers, but its value is never trusted — identity comes only from the
// authenticated session. This is what stops student A from reading student
// B's submissions by editing the URL.
export async function GET() {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('submissions')
    .select('*')
    .eq('student_id', session.student.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submissions: data })
}
