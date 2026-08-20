/**
 * selectAll() exists because PostgREST trims a response at max_rows (1000 by
 * default) without saying so — a truncated read looks exactly like a complete
 * one. These tests pin the two properties that make it safe to rely on.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PAGE_SIZE, selectAll } from '@/lib/naale/paginate'

/** A fake table of `total` rows that only ever serves one page at a time,
 *  the way PostgREST does. */
function pagerOver(total: number) {
  const calls: [number, number][] = []
  const page = async (from: number, to: number) => {
    calls.push([from, to])
    const rows = Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => ({ n: from + i }))
    return { data: rows, error: null }
  }
  return { page, calls }
}

test('reads past the row cap instead of stopping at the first page', async () => {
  const { page, calls } = pagerOver(1001)
  const rows = await selectAll<{ n: number }>('fake', page)
  assert.equal(rows.length, 1001)
  assert.equal(rows[0].n, 0)
  assert.equal(rows[1000].n, 1000)
  assert.equal(calls.length, Math.ceil(1001 / PAGE_SIZE) + (1001 % PAGE_SIZE === 0 ? 1 : 0))
})

test('a table smaller than one page costs exactly one request', async () => {
  const { page, calls } = pagerOver(3)
  assert.equal((await selectAll('fake', page)).length, 3)
  assert.equal(calls.length, 1)
})

test('an exactly-full final page still terminates', async () => {
  // The stopping rule is "a short page means done", so a table that is an
  // exact multiple of PAGE_SIZE needs one extra, empty read to know it's done.
  const { page } = pagerOver(PAGE_SIZE)
  assert.equal((await selectAll('fake', page)).length, PAGE_SIZE)
})

test('an empty table returns nothing rather than looping', async () => {
  const { page, calls } = pagerOver(0)
  assert.deepEqual(await selectAll('fake', page), [])
  assert.equal(calls.length, 1)
})

test('a query error throws instead of returning a partial list', async () => {
  // Returning what arrived so far would be the exact failure this guards
  // against: a caller treating some of the rows as all of them.
  let call = 0
  const page = async (from: number, to: number) => {
    call++
    if (call === 1) return { data: Array.from({ length: PAGE_SIZE }, (_, i) => ({ n: from + i })), error: null }
    return { data: null, error: { message: 'connection reset' }, _to: to }
  }
  await assert.rejects(() => selectAll('naale_answers', page), /naale_answers: paginated read failed at offset 500 — connection reset/)
})
