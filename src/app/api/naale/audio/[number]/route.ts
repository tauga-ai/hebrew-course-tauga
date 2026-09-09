import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getNaaleSession } from '@/lib/naale/auth'

const BUCKET = 'naale-audio'
const TOPIC_NUMBER = 5
const TOTAL_CLIPS = 53
// Same reasoning as /api/naale/pictures/[number] — long enough that a single
// practice session's repeats pay off, short enough that a corrected clip
// (upload-naale-audio.ts upserts) doesn't stay stale for long.
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
  if (!Number.isInteger(n) || n < 1 || n > TOTAL_CLIPS) {
    return NextResponse.json({ error: 'invalid_number' }, { status: 400 })
  }

  const db = createServiceClient()

  // Downloads the bytes ourselves (service-role, no signed URL) rather than
  // redirecting to one — same reasoning as the pictures route: a signed URL
  // comes back Cache-Control: no-cache, which would defeat caching a clip a
  // student replays several times in one question.
  const { data, error } = await db.storage.from(BUCKET).download(`${TOPIC_NUMBER}/${n}.mp3`)
  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return new NextResponse(data, {
    headers: {
      'Content-Type': 'audio/mpeg',
      // Without an explicit Content-Length, this response comes back
      // chunked — Chrome then reports the <audio> element's `duration` as
      // Infinity until the whole clip has buffered, breaking the player's
      // progress bar and total-time display until self-correction kicks in.
      'Content-Length': String(data.size),
      'Cache-Control': `private, max-age=${CACHE_MAX_AGE_SECONDS}`,
    },
  })
}
