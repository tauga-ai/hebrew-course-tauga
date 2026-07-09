import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentFromSession } from '@/lib/auth'

export async function GET() {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') return NextResponse.json({ submission: null })

  const db = createServiceClient()
  const { data, error } = await db
    .from('dapar_submissions')
    .select('answers, submitted_at')
    .eq('student_id', session.student.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  // PGRST116 = no rows found, expected when the student hasn't submitted yet
  if (error && error.code !== 'PGRST116') {
    console.error('dapar my-submission query failed:', error.message)
  }

  return NextResponse.json({ submission: data ?? null })
}
