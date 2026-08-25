import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'

/**
 * Updates the calling student's preferences. Currently only supports
 * translation_lang ('ru' | 'ar') — the language used by the hold-to-translate
 * feature during practice and placement sessions.
 */
export async function PATCH(req: NextRequest) {
  const session = await getNaaleSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let translation_lang: string
  try {
    ;({ translation_lang } = await req.json())
  } catch {
    return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 })
  }

  if (translation_lang !== 'ru' && translation_lang !== 'ar') {
    return NextResponse.json({ error: 'translation_lang must be ru or ar' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('students')
    .update({ translation_lang })
    .eq('id', session.student.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ translation_lang })
}
