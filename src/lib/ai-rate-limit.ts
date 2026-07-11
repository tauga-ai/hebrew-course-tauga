import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

const WINDOW_MS = 3 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 15

/**
 * Global per-student limit across all 5 AI-backed routes (not per-endpoint)
 * — switching endpoints shouldn't dodge the limit. Returns `ok: false` when
 * the student is over the limit; callers should respond 429 without calling
 * the AI provider. Counts first, inserts only if under the limit, so a
 * rejected request doesn't itself count toward the next window.
 */
export async function checkAiRateLimit(studentId: string, endpoint: string): Promise<{ ok: true } | { ok: false }> {
  const db = createServiceClient()
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()

  const { count } = await db
    .from('ai_rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .gte('created_at', windowStart)

  if ((count ?? 0) >= MAX_REQUESTS_PER_WINDOW) {
    return { ok: false }
  }

  await db.from('ai_rate_limits').insert({ student_id: studentId, endpoint })
  return { ok: true }
}
