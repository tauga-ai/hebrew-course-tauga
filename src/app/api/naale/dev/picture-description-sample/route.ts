import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { debugMode } from '@/lib/dev-i18n'

/**
 * Debug-only: the model IMAGE_DESCRIPTION for one picture-description
 * (תיאור תמונה בקול) question, for the "QA: fill good answer" button.
 *
 * Every other open-response topic's dev sample answer is built client-side
 * from `fields` (see open-exercise-display.ts's devSampleAnswers) — safe
 * there because those topics' grading-key fields (expected_phrasing,
 * expected_summary) are still only ever reached through this same
 * debug-gated tool. Picture-description can't do that: OPEN_PUBLIC_FIELD_KEYS
 * only ships `picture_number` to the client for this topic specifically
 * because image_description/mandatory_anchors are the answer key re-served
 * verbatim on the mistakes-review screen, so they never leave the server for
 * this topic at all. This route is the one place that boundary is crossed,
 * gated the same way as every other debug-only route here.
 */
export async function GET(req: NextRequest) {
  if (!debugMode) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const questionId = req.nextUrl.searchParams.get('question_id')
  if (!questionId) return NextResponse.json({ error: 'missing question_id' }, { status: 400 })

  const db = createServiceClient()
  const { data } = await db
    .from('naale_open_questions')
    .select('topic, fields')
    .eq('id', questionId)
    .maybeSingle()

  if (!data || data.topic !== 'תיאור תמונה בקול') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const fields = data.fields as Record<string, string>
  return NextResponse.json({ good: fields.image_description ?? '' })
}
