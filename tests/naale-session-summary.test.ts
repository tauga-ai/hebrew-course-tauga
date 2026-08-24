import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  rankSessionTopics,
  parseSessionSummary,
  SESSION_SUMMARY_FALLBACK,
} from '../src/lib/naale/session-summary'
import type { NaaleTopicStat } from '../src/lib/naale/stats'

/** Builds a topic stat from an accuracy percentage, filling in a consistent
 *  answered/correct pair so the totals a test asserts on stay believable. */
function topic(name: string, pct: number, answered = 4): NaaleTopicStat {
  return {
    topic: name,
    level: 1,
    answered,
    correct: Math.round((pct / 100) * answered),
    accuracy_pct: pct,
    started: true,
  }
}

test('rankSessionTopics: empty strong/weak when every topic scored identically', () => {
  const r = rankSessionTopics([topic('a', 50), topic('b', 50), topic('c', 50)])
  assert.deepEqual(r.strong, [], 'nothing distinguishes these topics')
  assert.deepEqual(r.weak, [])
  assert.equal(r.score_pct, 50)
})

test('rankSessionTopics: all-low scores still yield a relative best', () => {
  // Noam's spec is explicit: "Even if all scores in the session are very low,
  // you must still identify the relatively highest score."
  const r = rankSessionTopics([topic('a', 25), topic('b', 0), topic('c', 10), topic('d', 5)])
  assert.deepEqual(r.strong, ['a', 'c'])
  assert.deepEqual(r.weak, ['b', 'd'])
})

test('rankSessionTopics: all-high scores still yield a relative worst', () => {
  const r = rankSessionTopics([topic('a', 100), topic('b', 90), topic('c', 95), topic('d', 100)])
  assert.deepEqual(r.weak, ['b', 'c'])
  assert.equal(r.strong.length, 2)
  assert.ok(!r.strong.some(t => r.weak.includes(t)), 'lists must stay disjoint')
})

test('rankSessionTopics: a single topic produces empty lists, not itself twice', () => {
  const r = rankSessionTopics([topic('a', 75)])
  assert.deepEqual(r.strong, [])
  assert.deepEqual(r.weak, [])
  assert.equal(r.score_pct, 75)
})

test('rankSessionTopics: 2 and 3 topics take one from each end, never overlapping', () => {
  const two = rankSessionTopics([topic('hi', 100), topic('lo', 0)])
  assert.deepEqual(two.strong, ['hi'])
  assert.deepEqual(two.weak, ['lo'])

  const three = rankSessionTopics([topic('hi', 100), topic('mid', 50), topic('lo', 0)])
  assert.deepEqual(three.strong, ['hi'])
  assert.deepEqual(three.weak, ['lo'])
  assert.ok(!three.strong.some(t => three.weak.includes(t)))
})

test('rankSessionTopics: caps at 2 per side however many topics there are', () => {
  const r = rankSessionTopics([
    topic('a', 100), topic('b', 80), topic('c', 60),
    topic('d', 40), topic('e', 20), topic('f', 0),
  ])
  assert.deepEqual(r.strong, ['a', 'b'])
  assert.deepEqual(r.weak, ['f', 'e'], 'weak is worst-first')
})

test('rankSessionTopics: untouched topics are excluded, not treated as 0%', () => {
  const untouched: NaaleTopicStat = {
    topic: 'never-shown', level: null, answered: 0, correct: 0, accuracy_pct: null, started: false,
  }
  const r = rankSessionTopics([topic('a', 100), topic('b', 50), untouched])
  assert.ok(!r.weak.includes('never-shown'), 'a topic the session never showed is not a weakness')
  assert.ok(!r.strong.includes('never-shown'))
  assert.deepEqual(r.strong, ['a'])
  assert.deepEqual(r.weak, ['b'])
})

test('rankSessionTopics: score_pct is a whole number over real answer counts', () => {
  // 2/3 correct = 66.67% -> the prompt takes "67", not a long decimal.
  const r = rankSessionTopics([
    { topic: 'a', level: 1, answered: 3, correct: 2, accuracy_pct: (2 / 3) * 100, started: true },
  ])
  assert.equal(r.score_pct, 67)
})

test('rankSessionTopics: no answers at all yields 0% and empty lists', () => {
  assert.deepEqual(rankSessionTopics([]), { score_pct: 0, strong: [], weak: [] })
})

test('parseSessionSummary: accepts a well-formed reply and trims it', () => {
  const r = parseSessionSummary('{"summary_text": "  איזה יופי של עבודה!  ", "ui_icon": "🌟"}')
  assert.equal(r.summary_text, 'איזה יופי של עבודה!')
  assert.equal(r.ui_icon, '🌟')
})

test('parseSessionSummary: rejects malformed JSON', () => {
  assert.throws(() => parseSessionSummary('not json at all'))
})

test('parseSessionSummary: rejects a wrong-shaped or empty reply', () => {
  assert.throws(() => parseSessionSummary('{"summary_text": "hi"}'), /Malformed/)
  assert.throws(() => parseSessionSummary('{"summary_text": "   ", "ui_icon": "🌟"}'), /Malformed/)
  assert.throws(() => parseSessionSummary('{"summary_text": 5, "ui_icon": "🌟"}'), /Malformed/)
})

test('the hardcoded fallback matches Noam\'s spec exactly', () => {
  assert.equal(SESSION_SUMMARY_FALLBACK, 'כל הכבוד על סיום הסשן! המשך לתרגל כדי להשתפר.')
})
