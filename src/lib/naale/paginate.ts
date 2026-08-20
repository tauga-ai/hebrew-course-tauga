/**
 * PostgREST caps every response at the project's `max_rows` (1000 by default)
 * and does it SILENTLY — a truncated result is indistinguishable from a
 * complete one. No error, no flag, just fewer rows than the table holds.
 *
 * That already bit us once: the stats screens derived their topic list by
 * reading one row per question, and the MCQ bank reached exactly 1000 rows —
 * one import away from silently dropping a topic off both screens.
 *
 * So the rule for this track is: any read whose row count grows with usage
 * goes through selectAll(). Reads bounded by something small and fixed (one
 * session's answers, one student's seven topic levels, a single row by id)
 * don't need it. tests/naale-pagination-guard.test.mjs enforces this.
 */

/** Comfortably under any plausible max_rows, so a page is never itself
 *  truncated — which would make the "short page means done" check below lie
 *  and silently end the loop early. */
export const PAGE_SIZE = 500

interface PageResult<T> {
  data: T[] | null
  error: { message: string } | null
}

/**
 * Reads every row of a query, a page at a time.
 *
 * `page` receives the inclusive range bounds to pass to `.range(from, to)`;
 * everything else about the query — table, columns, filters — stays at the
 * call site, so this doesn't become a second query builder.
 *
 *   const answers = await selectAll('naale_answers', (from, to) =>
 *     db.from('naale_answers').select('topic, score').in('student_id', ids).range(from, to))
 *
 * Throws on a query error rather than returning a partial list: a caller that
 * silently treated half the rows as all of them is the exact failure this
 * exists to prevent.
 */
export async function selectAll<T>(
  label: string,
  page: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${label}: paginated read failed at offset ${from} — ${error.message}`)
    rows.push(...(data ?? []))
    // A short page means the table had nothing more to give.
    if ((data?.length ?? 0) < PAGE_SIZE) return rows
  }
}
