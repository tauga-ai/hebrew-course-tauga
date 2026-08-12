import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickReviewQuestions, REVIEW_QUESTION_COUNT, type PreviousAnswer } from '../src/lib/naale/review'

test('pickReviewQuestions: all wrong — picks the hardest wrong ones, up to count', () => {
  const previous: PreviousAnswer[] = [
    { question_id: 'a', difficulty: 2, is_correct: false },
    { question_id: 'b', difficulty: 5, is_correct: false },
    { question_id: 'c', difficulty: 3, is_correct: false },
    { question_id: 'd', difficulty: 1, is_correct: false },
  ]
  assert.deepEqual(pickReviewQuestions(previous, 3), ['b', 'c', 'a'])
})

test('pickReviewQuestions: all correct — falls back to the hardest correct ones', () => {
  const previous: PreviousAnswer[] = [
    { question_id: 'a', difficulty: 1, is_correct: true },
    { question_id: 'b', difficulty: 4, is_correct: true },
    { question_id: 'c', difficulty: 2, is_correct: true },
  ]
  assert.deepEqual(pickReviewQuestions(previous, 2), ['b', 'c'])
})

test('pickReviewQuestions: mixed — wrong ones first, topped up with hardest correct', () => {
  const previous: PreviousAnswer[] = [
    { question_id: 'wrong-easy', difficulty: 1, is_correct: false },
    { question_id: 'correct-hard', difficulty: 5, is_correct: true },
    { question_id: 'correct-mid', difficulty: 3, is_correct: true },
  ]
  assert.deepEqual(pickReviewQuestions(previous, 2), ['wrong-easy', 'correct-hard'])
})

test('pickReviewQuestions: fewer answers than count — returns what exists, not padded', () => {
  const previous: PreviousAnswer[] = [{ question_id: 'only', difficulty: 3, is_correct: false }]
  assert.deepEqual(pickReviewQuestions(previous, REVIEW_QUESTION_COUNT), ['only'])
})

test('pickReviewQuestions: zero answers — returns empty, does not throw', () => {
  assert.deepEqual(pickReviewQuestions([], REVIEW_QUESTION_COUNT), [])
})

test('REVIEW_QUESTION_COUNT is the spec\'s upper bound of "2-3"', () => {
  assert.equal(REVIEW_QUESTION_COUNT, 3)
})
