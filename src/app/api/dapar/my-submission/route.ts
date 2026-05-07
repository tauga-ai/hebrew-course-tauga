import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const student_id = searchParams.get('student_id')
  if (!student_id) return NextResponse.json({ submission: null })

  const db = createServiceClient()
  const { data } = await db
    .from('dapar_submissions')
    .select('answers, submitted_at')
    .eq('student_id', student_id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ submission: data ?? null })
}
