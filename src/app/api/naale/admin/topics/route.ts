import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireNaaleAdmin } from '@/lib/naale/auth'
import { loadAllTopics, loadDisabledTopics } from '@/lib/naale/topics'

const MIN_ENABLED_TOPICS = 3

async function guard() {
  const admin = await requireNaaleAdmin()
  if (admin.status === 'unauthenticated') return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (admin.status === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  return null
}

export async function GET() {
  const blocked = await guard()
  if (blocked) return blocked

  const db = createServiceClient()
  const [allTopics, { data: flagRows }] = await Promise.all([
    loadAllTopics(db),
    db.from('naale_topic_flags').select('topic, enabled'),
  ])
  const enabledByTopic = new Map((flagRows ?? []).map(f => [f.topic, f.enabled]))
  const topics = allTopics.map(topic => ({ topic, enabled: enabledByTopic.get(topic) ?? true }))

  return NextResponse.json({ topics })
}

export async function PATCH(request: Request) {
  const blocked = await guard()
  if (blocked) return blocked

  const { topic, enabled } = await request.json()
  if (typeof topic !== 'string' || !topic.trim() || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const db = createServiceClient()

  // Defense in depth alongside the admin UI's own check — the UI already
  // blocks a toggle that would cross this line, but the server is the one
  // place that can't be bypassed by calling this route directly.
  if (!enabled) {
    const [allTopics, disabled] = await Promise.all([loadAllTopics(db), loadDisabledTopics(db)])
    const currentlyEnabledCount = allTopics.filter(name => !disabled.has(name)).length
    if (!disabled.has(topic) && currentlyEnabledCount <= MIN_ENABLED_TOPICS) {
      return NextResponse.json({ error: 'לפחות 3 נושאים חייבים להישאר פעילים' }, { status: 400 })
    }
  }

  const { error } = await db
    .from('naale_topic_flags')
    .upsert({ topic, enabled, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
