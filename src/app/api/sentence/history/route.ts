import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentFromSession } from '@/lib/auth'
import type { SentenceFeedback } from '@/app/api/sentence/feedback/route'

export interface SentenceHistoryEntry {
  id: string
  set_id: number
  exercise_idx: number
  score: number
  sentence_text: string | null
  feedback: SentenceFeedback | null
  created_at: string
}

/** The authenticated student's own past sentence-building attempts (curated sets), most recent first. */
export async function GET() {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('sentence_results')
    .select('id, set_id, exercise_idx, score, sentence_text, feedback, created_at')
    .eq('student_id', session.student.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ entries: (data ?? []) as SentenceHistoryEntry[] })
}
