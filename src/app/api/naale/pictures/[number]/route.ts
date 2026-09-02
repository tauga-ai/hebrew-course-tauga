import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'

const BUCKET = 'naale-pictures'
const TOPIC_NUMBER = 12
// Long enough that a cached redirect (see Cache-Control below) stays valid
// for a full practice session, short enough that a leaked signed URL doesn't
// stay live for long.
const SIGNED_URL_TTL_SECONDS = 3600

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

  // Stored extension-less (upload-naale-pictures.ts uploads to `{topic}/{n}`, no extension) —
  // Content-Type comes from the object's stored metadata, not its key, so the exact path is
  // known upfront. This used to require a list() call first to discover the real extension
  // (.jpg vs .png); removing that cut a full extra Storage round-trip off every image load.
  const { data: signed, error: signError } = await db.storage
    .from(BUCKET)
    .createSignedUrl(`${TOPIC_NUMBER}/${n}`, SIGNED_URL_TTL_SECONDS)
  if (signError || !signed) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.redirect(signed.signedUrl, {
    // Lets the browser skip re-hitting this route (auth check + a Storage API call) on every
    // repeat view of the same picture within a session — it reuses the cached redirect target
    // directly. Capped just under the signed URL's own TTL so a cached redirect never points at
    // an already-expired URL.
    headers: { 'Cache-Control': `private, max-age=${SIGNED_URL_TTL_SECONDS - 60}` },
  })
}
