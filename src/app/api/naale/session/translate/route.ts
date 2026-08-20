import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'
import { loadOwnedSession, isExpired } from '@/lib/naale/session'
import { translateWord } from '@/lib/naale/translate'
import { sessionTranslationCap } from '@/lib/naale/translation-limits'

/**
 * Hover- (or long-press-) to-translate a single word, during any live Naale
 * session —
 * practice or placement, both are naale_sessions rows, so this route
 * doesn't need to know which. The per-session cap is enforced here from the
 * session row itself, never trusted from the client — same principle as
 * grading always happening server-side in session/answer/route.ts.
 */
export async function POST(req: NextRequest) {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let session_id: string, word: string
  try {
    ({ session_id, word } = await req.json())
  } catch {
    return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 }) // "Invalid request body"
  }
  const cleaned = String(word ?? '').trim()
  if (!session_id || !cleaned) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 }) // "Missing fields"
  }

  const owned = await loadOwnedSession(session_id, session.student.id)
  if (!owned.ok) return NextResponse.json({ error: 'תרגול לא נמצא' }, { status: 404 }) // "Session not found"
  if (owned.session.ended_at || isExpired(owned.session.deadline_at)) {
    return NextResponse.json({ error: 'הזמן נגמר', code: 'expired' }, { status: 409 }) // "Time's up"
  }

  // A word already translated earlier in this same session is free to
  // re-check — the cap limits how many DIFFERENT words a student looks up,
  // not how many times they glance at one they've already unlocked. So this
  // check happens before the cap gate, and bypasses it entirely.
  const alreadyThisSession = owned.session.translated_words.includes(cleaned)

  const cap = sessionTranslationCap()
  if (!alreadyThisSession && owned.session.translations_used >= cap) {
    return NextResponse.json({ limited: true, used: owned.session.translations_used, cap })
  }

  const db = createServiceClient()
  let translation: string
  try {
    translation = await translateWord(db, cleaned)
  } catch (err) {
    console.error('Naale translate error:', err)
    return NextResponse.json({ error: 'התרגום נכשל' }, { status: 502 }) // "Translation failed"
  }

  let used = owned.session.translations_used
  if (!alreadyThisSession) {
    used += 1
    await db
      .from('naale_sessions')
      .update({ translations_used: used, translated_words: [...owned.session.translated_words, cleaned] })
      .eq('id', session_id)
  }

  // used/cap are QA-only (see the dev-only badge in session/page.tsx and
  // placement/page.tsx) — real students never see a countdown, per Yuval's
  // explicit "should not be advertised... during normal use."
  return NextResponse.json({ limited: false, translation, used, cap })
}
