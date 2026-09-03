import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'

const BUCKET = 'naale-pictures'
const TOPIC_NUMBER = 12
// How long the browser can reuse an already-fetched picture with zero network request at all.
// Images occasionally get corrected (upload-naale-pictures.ts upserts), so not forever — long
// enough that a single practice session's repeat views and the prefetch this route exists to
// serve (naale-picture-description-image-prefetch) both actually pay off.
const CACHE_MAX_AGE_SECONDS = 3600

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

  // Downloads the bytes ourselves (service-role, no signed URL) instead of redirecting to one —
  // found live that Supabase's signed-URL responses are Cache-Control: no-cache, so even a
  // prefetched image couldn't be reused without a network round-trip every time. Serving the
  // bytes directly lets us set our own cacheable header instead, so a repeat request for the
  // same picture is a real, zero-network browser cache hit.
  const { data, error } = await db.storage.from(BUCKET).download(`${TOPIC_NUMBER}/${n}`)
  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Always JPEG — upload-naale-pictures.ts re-encodes every source image to JPEG regardless of
  // its original format (naale-picture-description-image-compression).
  return new NextResponse(data, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': `private, max-age=${CACHE_MAX_AGE_SECONDS}`,
    },
  })
}
