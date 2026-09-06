import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession } from '@/lib/naale/session'

const MAX_SUGGESTIONS_LENGTH = 2000

function isValidRating(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5
}

/**
 * Stores one submission of the naale-session-feedback-popup form. Ownership
 * of session_id is re-checked server-side (never trust a client-supplied
 * id) — same pattern as /session/end.
 */
export async function POST(req: NextRequest) {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let body: { session_id?: string; question_quality?: number; interface_rating?: number; suggestions?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 })
  }

  const { session_id, question_quality, interface_rating, suggestions } = body
  if (
    typeof session_id !== 'string' || !session_id ||
    !isValidRating(question_quality) ||
    !isValidRating(interface_rating) ||
    (suggestions !== undefined && (typeof suggestions !== 'string' || suggestions.length > MAX_SUGGESTIONS_LENGTH))
  ) {
    return NextResponse.json({ error: 'שדות לא תקינים' }, { status: 400 })
  }

  const owned = await loadOwnedSession(session_id, session.student.id)
  if (!owned.ok) return NextResponse.json({ error: 'תרגול לא נמצא' }, { status: 404 })

  const db = createServiceClient()
  // Idempotent, same contract as /session/end: a double-submit (double-
  // click, a retried request) finds the existing row and reports success
  // instead of hitting the unique constraint on session_id.
  const { data: existing } = await db
    .from('naale_session_feedback')
    .select('id')
    .eq('session_id', session_id)
    .maybeSingle()
  if (existing) return NextResponse.json({ ok: true })

  const { error } = await db.from('naale_session_feedback').insert({
    student_id: session.student.id,
    session_id,
    question_quality,
    interface_rating,
    suggestions: suggestions?.trim() || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
