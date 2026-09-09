/**
 * partitionByExisting() is what makes a re-imported workbook insert-only —
 * a question_id already in the DB must never be silently overwritten again,
 * since that's now the report page's quick-edit job instead
 * (naale-report-quick-edit). Pure and DB-free: `existing` here is just
 * whatever the caller already read, no real Supabase client involved.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { partitionByExisting } from '@/lib/naale/question-import'

test('a row whose (topic, question_id) is already in the DB is reported, not inserted', () => {
  const allRows = [
    { topic: 'a', question_id: '1_1', prompt: 'new wording' },
    { topic: 'a', question_id: '1_2', prompt: 'brand new question' },
  ]
  const existing = [{ topic: 'a', question_id: '1_1' }]

  const { newRows, alreadyExists } = partitionByExisting(allRows, existing)

  assert.deepEqual(newRows, [{ topic: 'a', question_id: '1_2', prompt: 'brand new question' }])
  assert.deepEqual(alreadyExists, [{ topic: 'a', question_id: '1_1' }])
})

test('matching is scoped to (topic, question_id) together — same id under a different topic is still new', () => {
  const allRows = [{ topic: 'b', question_id: '1_1', prompt: 'different topic, same numbering' }]
  const existing = [{ topic: 'a', question_id: '1_1' }]

  const { newRows, alreadyExists } = partitionByExisting(allRows, existing)

  assert.deepEqual(newRows, allRows)
  assert.deepEqual(alreadyExists, [])
})

test('an empty existing set means every row is new', () => {
  const allRows = [
    { topic: 'a', question_id: '1_1', prompt: 'x' },
    { topic: 'a', question_id: '1_2', prompt: 'y' },
  ]

  const { newRows, alreadyExists } = partitionByExisting(allRows, [])

  assert.deepEqual(newRows, allRows)
  assert.deepEqual(alreadyExists, [])
})

test('a workbook with no genuinely new rows inserts nothing and reports every row as already-existing', () => {
  const allRows = [{ topic: 'a', question_id: '1_1', prompt: 'x' }]
  const existing = [{ topic: 'a', question_id: '1_1' }]

  const { newRows, alreadyExists } = partitionByExisting(allRows, existing)

  assert.deepEqual(newRows, [])
  assert.deepEqual(alreadyExists, [{ topic: 'a', question_id: '1_1' }])
})
