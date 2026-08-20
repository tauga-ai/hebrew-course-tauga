import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  pickReviewQuestions,
  pickReviewQueue,
  toReviewCandidates,
  REVIEW_QUESTION_COUNT,
  type PreviousAnswer,
} from '../src/lib/naale/review'
import { GRADED_CORRECT_SCORE } from '../src/lib/naale/stats'

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

// --- The merged session opener (#5 / H2) ---------------------------------
//
// The opener read only naale_answers, so the three AI-graded topics could
// never resurface no matter how badly a student did on them. These pin the
// behaviour that fixes it.

test('toReviewCandidates: tags each answer with the bank it has to be served from', () => {
  const candidates = toReviewCandidates(
    [{ question_id: 'm1', difficulty: 3, is_correct: true }],
    [{ question_id: 'o1', difficulty: 4, score: 5 }]
  )
  assert.deepEqual(candidates.map(c => [c.question_id, c.kind]), [['m1', 'mcq'], ['o1', 'open']])
})

// Finding L3: this queue used to call a 3 correct, so a merely-passable graded
// answer was never re-served. Every other reading of a graded answer puts the
// floor at 4.
test('toReviewCandidates: a graded 3 is review-worthy, 4 and 5 are not', () => {
  const [one, two, three, four, five] = toReviewCandidates(
    [],
    [1, 2, 3, 4, 5].map((score, i) => ({ question_id: `o${i}`, difficulty: 1, score }))
  )
  assert.equal(one.is_correct, false)
  assert.equal(two.is_correct, false)
  assert.equal(three.is_correct, false, 'a 3 must be review-worthy — it was treated as correct before')
  assert.equal(four.is_correct, true)
  assert.equal(five.is_correct, true)
  assert.equal(GRADED_CORRECT_SCORE, 4)
})

test('pickReviewQueue: wrong answers win regardless of which bank they came from', () => {
  const queue = pickReviewQueue(
    toReviewCandidates(
      [{ question_id: 'm-easy-ok', difficulty: 5, is_correct: true }],
      [
        { question_id: 'o-hard-bad', difficulty: 4, score: 1 },
        { question_id: 'o-mid-bad', difficulty: 2, score: 3 },
      ]
    ),
    3
  )
  // Both graded failures come first, hardest first; the correct MCQ answer
  // only tops up the remaining slot.
  assert.deepEqual(queue, [
    { question_id: 'o-hard-bad', kind: 'open' },
    { question_id: 'o-mid-bad', kind: 'open' },
    { question_id: 'm-easy-ok', kind: 'mcq' },
  ])
})

// The reason the two banks share one queue rather than running one each: the
// spec asks for "2-3 hard exercises from the previous session", a count of
// exercises, not a count per exercise type.
test('pickReviewQueue: one pool capped in total, not one queue per bank', () => {
  const queue = pickReviewQueue(
    toReviewCandidates(
      [1, 2, 3].map(i => ({ question_id: `m${i}`, difficulty: i, is_correct: false })),
      [1, 2, 3].map(i => ({ question_id: `o${i}`, difficulty: i, score: 1 }))
    ),
    REVIEW_QUESTION_COUNT
  )
  assert.equal(queue.length, REVIEW_QUESTION_COUNT)
})

test('pickReviewQueue: an all-MCQ previous session still yields an all-MCQ queue', () => {
  const queue = pickReviewQueue(
    toReviewCandidates([{ question_id: 'm1', difficulty: 2, is_correct: false }], []),
    3
  )
  assert.deepEqual(queue, [{ question_id: 'm1', kind: 'mcq' }])
})

test('pickReviewQueue: nothing to review returns empty, does not throw', () => {
  assert.deepEqual(pickReviewQueue(toReviewCandidates([], []), 3), [])
})
