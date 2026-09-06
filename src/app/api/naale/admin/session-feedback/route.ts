import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireNaaleAdmin } from '@/lib/naale/auth'
import { selectAll } from '@/lib/naale/paginate'
import { weekKey } from '@/lib/naale/rewards'

type FeedbackRow = {
  created_at: string
  question_quality: number
  interface_rating: number
  suggestions: string | null
}

/** Count per rating value, index 0 = rating 1 ... index 4 = rating 5. */
function distribution(values: number[]): number[] {
  const counts = [0, 0, 0, 0, 0]
  for (const v of values) counts[v - 1]++
  return counts
}

/**
 * Admin-only dashboard data for naale-session-feedback-popup's responses
 * (naale-session-feedback-admin-dashboard). Read-only, no student
 * identification — see task.md §1.
 */
export async function GET() {
  const admin = await requireNaaleAdmin()
  if (admin.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (admin.status === 'forbidden') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const db = createServiceClient()

  // Paginated: naale_session_feedback is already in GROWTH_TABLES.
  const rows = await selectAll<FeedbackRow>('naale_session_feedback', (from, to) =>
    db
      .from('naale_session_feedback')
      .select('created_at, question_quality, interface_rating, suggestions')
      .order('created_at', { ascending: false })
      .range(from, to)
  )

  const quality_distribution = distribution(rows.map(r => r.question_quality))
  const interface_distribution = distribution(rows.map(r => r.interface_rating))

  // Weekly averages, Sunday-start (same boundary as the streak feature).
  const byWeek = new Map<string, { qualitySum: number; interfaceSum: number; count: number }>()
  for (const r of rows) {
    const key = weekKey(new Date(r.created_at))
    const bucket = byWeek.get(key) ?? { qualitySum: 0, interfaceSum: 0, count: 0 }
    bucket.qualitySum += r.question_quality
    bucket.interfaceSum += r.interface_rating
    bucket.count++
    byWeek.set(key, bucket)
  }
  const weekly_trend = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, b]) => ({
      week,
      avg_quality: Math.round((b.qualitySum / b.count) * 10) / 10,
      avg_interface: Math.round((b.interfaceSum / b.count) * 10) / 10,
    }))

  const suggestions = rows
    .filter(r => r.suggestions)
    .map(r => ({ created_at: r.created_at, question_quality: r.question_quality, interface_rating: r.interface_rating, suggestions: r.suggestions }))

  return NextResponse.json({
    total_responses: rows.length,
    quality_distribution,
    interface_distribution,
    weekly_trend,
    suggestions,
  })
}
