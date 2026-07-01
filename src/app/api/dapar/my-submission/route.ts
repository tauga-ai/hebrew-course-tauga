import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getStudentFromSession } from '@/lib/auth'

export async function GET() {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') return NextResponse.json({ submission: null })

  const db = createServiceClient()
  const { data } = await db
    .from('dapar_submissions')
    .select('answers, submitted_at')
    .eq('student_id', session.student.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ submission: data ?? null })
}
