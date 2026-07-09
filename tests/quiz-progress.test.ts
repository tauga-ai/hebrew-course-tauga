import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enrichProgress, computeStats } from '../src/lib/quiz-progress'

interface FakeQuestion { correctOption: number; explanation: string[] }
const QUESTIONS: Record<number, FakeQuestion> = {
  1: { correctOption: 2, explanation: ['why 2'] },
}
const lookup = (id: number) => QUESTIONS[id] ?? null

test('enrichProgress: attaches correct_option/explanation for a known question', () => {
  const result = enrichProgress([{ question_id: 1, selected_option: 2, is_correct: true }], lookup)
  assert.equal(result[0].correct_option, 2)
  assert.deepEqual(result[0].explanation, ['why 2'])
  assert.equal(result[0].selected_option, 2)
})

test('enrichProgress: falls back to null for an unknown question', () => {
  const result = enrichProgress([{ question_id: 999, selected_option: 1, is_correct: false }], lookup)
  assert.equal(result[0].correct_option, null)
  assert.equal(result[0].explanation, null)
})

test('enrichProgress: empty rows produce an empty array', () => {
  assert.deepEqual(enrichProgress([], lookup), [])
})

test('computeStats: null avg_pct when nothing attempted', () => {
  const stats = computeStats([], 10)
  assert.equal(stats.attempted, 0)
  assert.equal(stats.total, 10)
  assert.equal(stats.avg_pct, null)
})

test('computeStats: computes accuracy percentage from mixed rows', () => {
  const stats = computeStats([{ is_correct: true }, { is_correct: true }, { is_correct: false }], 20)
  assert.equal(stats.attempted, 3)
  assert.equal(stats.total, 20)
  assert.ok(Math.abs(stats.avg_pct! - (200 / 3)) < 1e-9)
})
