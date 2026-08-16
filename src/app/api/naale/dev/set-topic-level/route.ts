import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { debugMode } from '@/lib/dev-i18n'
import { MIN_LEVEL, MAX_LEVEL } from '@/lib/naale/leveling'

/**
 * Debug-only: force-sets the caller's level for one topic, to jump straight
 * to testing a given difficulty band's questions (session/next walks
 * difficultyLadder(level) per topic) without grinding real answers there.
 *
 * correct_streak/wrong_streak are always reset to 0 alongside the level,
 * never left as whatever they were — per leveling.ts's applyAnswer(), every
 * real level transition resets both streaks to 0, so that's the only
 * internally-consistent baseline for a forced level too. Leaving a stale
 * streak in place risks an immediate, confusing level change on the very
 * next real answer.
 *
 * Also clears this topic's naale_answers: /session/next's "unseen question"
 * check is lifetime-scoped across ALL of this student's answers, not
 * session-scoped, so a QA account that already exhausted lower difficulties
 * in earlier testing would have every level below 5 look already-answered —
 * silently keeping /next stuck serving level-5 questions no matter what
 * level this route just wrote. Clearing the topic's answer history is what
 * makes the forced level actually observable in what gets served next.
 */
export async function POST(req: NextRequest) {
  if (!debugMode) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const topic = typeof body?.topic === 'string' ? body.topic.trim() : ''
  if (!topic) return NextResponse.json({ error: 'missing topic' }, { status: 400 })

  const requested = Number(body?.level)
  const level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Number.isFinite(requested) ? requested : MIN_LEVEL))

  const db = createServiceClient()
  const { error } = await db.from('naale_topic_levels').upsert(
    {
      student_id: session.student.id,
      topic,
      level,
      correct_streak: 0,
      wrong_streak: 0,
      answered_count: 0,
    },
    { onConflict: 'student_id,topic' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: clearError } = await db
    .from('naale_answers')
    .delete()
    .eq('student_id', session.student.id)
    .eq('topic', topic)

  if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 })

  return NextResponse.json({ topic, level })
}
