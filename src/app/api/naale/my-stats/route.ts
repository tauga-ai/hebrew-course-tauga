import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { buildTopicStats } from '@/lib/naale/stats'

/**
 * The authenticated Naale student's own progress — per-topic level and exercise
 * counts. This is the spec's JSON "ID card": it isn't stored as a blob anywhere,
 * it's assembled here from naale_topic_levels + naale_answers.
 *
 * Scoped to session.student.id only. There is deliberately no student_id
 * parameter — students see themselves and nobody else (staff use
 * /api/naale/staff/students instead).
 */
export async function GET() {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()

  const [{ data: bankTopics }, { data: levels }, { data: answers }, { data: sessions }] = await Promise.all([
    db.from('naale_questions').select('topic'),
    db.from('naale_topic_levels').select('topic, level').eq('student_id', session.student.id),
    db.from('naale_answers').select('topic, is_correct').eq('student_id', session.student.id),
    db.from('naale_sessions').select('id, completed').eq('student_id', session.student.id),
  ])

  const allTopics = [...new Set((bankTopics ?? []).map(r => r.topic))].sort()
  const topics = buildTopicStats(allTopics, levels ?? [], answers ?? [])

  return NextResponse.json({
    topics,
    totals: {
      answered: (answers ?? []).length,
      correct: (answers ?? []).filter(a => a.is_correct).length,
      sessions: (sessions ?? []).length,
      completed_sessions: (sessions ?? []).filter(s => s.completed).length,
    },
  })
}
