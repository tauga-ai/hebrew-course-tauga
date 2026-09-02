import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'

const BUCKET = 'naale-pictures'
const TOPIC_NUMBER = 12
const SIGNED_URL_TTL_SECONDS = 60

export async function GET(_request: Request, { params }: { params: Promise<{ number: string }> }) {
  const session = await getNaaleSession()
  if (session.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (session.status === 'not_on_roster') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { number } = await params
  const n = Number(number)
  if (!Number.isInteger(n) || n < 1 || n > 30) {
    return NextResponse.json({ error: 'invalid_number' }, { status: 400 })
  }

  const db = createServiceClient()

  // Extension isn't known ahead of time (source images are a mix of .jpg/.png), so resolve
  // the actual stored filename by prefix rather than guessing. Each topic gets its own folder
  // in the bucket (e.g. `12/`), so the search is scoped to that folder, not the whole bucket.
  const { data: matches, error: listError } = await db.storage.from(BUCKET).list(String(TOPIC_NUMBER), {
    search: `${n}.`,
  })
  if (listError || !matches?.length) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { data: signed, error: signError } = await db.storage
    .from(BUCKET)
    .createSignedUrl(`${TOPIC_NUMBER}/${matches[0].name}`, SIGNED_URL_TTL_SECONDS)
  if (signError || !signed) {
    return NextResponse.json({ error: 'sign_failed' }, { status: 500 })
  }

  return NextResponse.redirect(signed.signedUrl)
}
