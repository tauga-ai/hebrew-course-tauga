import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentFromSession } from '@/lib/auth'
import type { SentenceFeedback } from '@/app/api/sentence/feedback/route'
import type { AIWordList } from '@/app/api/ai-practice/sentence-words/route'

export interface AISentenceHistoryEntry {
  id: string
  level: number
  score: number
  sentence_text: string | null
  feedback: SentenceFeedback | null
  word_list: AIWordList | null
  created_at: string
}

/** The authenticated student's own past AI-generated sentence-building attempts, most recent first. */
export async function GET() {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('ai_sentence_results')
    .select('id, level, score, sentence_text, feedback, word_list, created_at')
    .eq('student_id', session.student.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ entries: (data ?? []) as AISentenceHistoryEntry[] })
}
