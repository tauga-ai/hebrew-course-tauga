import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentFromSession } from '@/lib/auth'

/** The authenticated student's own AI-practice performance summary — reading and sentence, each scored on its own native scale. */
export async function GET() {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const [readingRes, sentenceRes] = await Promise.all([
    db.from('ai_reading_results').select('is_correct').eq('student_id', session.student.id),
    db.from('ai_sentence_results').select('score').eq('student_id', session.student.id),
  ])

  const readingRows = readingRes.data || []
  const sentenceRows = sentenceRes.data || []

  return NextResponse.json({
    reading: {
      attempted: readingRows.length,
      avg_pct: readingRows.length > 0
        ? (readingRows.filter(r => r.is_correct).length / readingRows.length) * 100
        : null,
    },
    sentence: {
      attempted: sentenceRows.length,
      avg_score: sentenceRows.length > 0
        ? sentenceRows.reduce((sum, r) => sum + r.score, 0) / sentenceRows.length
        : null,
    },
  })
}
