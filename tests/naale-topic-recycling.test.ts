import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickRecycledQuestionId, type RecyclingAnswer } from '../src/lib/naale/topic-recycling'

test('pickRecycledQuestionId: picks the question that has gone longest without an answer', () => {
  const answers: RecyclingAnswer[] = [
    { question_id: 'a', session_id: 's1', answered_at: '2026-09-01T00:00:00Z' },
    { question_id: 'b', session_id: 's1', answered_at: '2026-09-02T00:00:00Z' },
  ]
  assert.equal(pickRecycledQuestionId(answers, 'sNow'), 'a')
})

test('pickRecycledQuestionId: a question re-answered since must NOT keep winning off its first-ever timestamp', () => {
  // Reproduces the real bug: question "a" was answered first (way back), then recycled and
  // re-answered twice since — its most recent answer is now newer than "b"'s only answer, so
  // "b" should win, not "a" forever.
  const answers: RecyclingAnswer[] = [
    { question_id: 'a', session_id: 's1', answered_at: '2026-09-01T00:00:00Z' },
    { question_id: 'b', session_id: 's2', answered_at: '2026-09-02T00:00:00Z' },
    { question_id: 'a', session_id: 's3', answered_at: '2026-09-03T00:00:00Z' },
  ]
  assert.equal(pickRecycledQuestionId(answers, 'sNow'), 'b')
})

test('pickRecycledQuestionId: excludes a question already answered in the current session', () => {
  const answers: RecyclingAnswer[] = [
    { question_id: 'a', session_id: 'sNow', answered_at: '2026-09-01T00:00:00Z' },
    { question_id: 'b', session_id: 's1', answered_at: '2026-09-02T00:00:00Z' },
  ]
  assert.equal(pickRecycledQuestionId(answers, 'sNow'), 'b')
})

test('pickRecycledQuestionId: returns null when nothing is eligible', () => {
  assert.equal(pickRecycledQuestionId([], 'sNow'), null)
  const onlyThisSession: RecyclingAnswer[] = [
    { question_id: 'a', session_id: 'sNow', answered_at: '2026-09-01T00:00:00Z' },
  ]
  assert.equal(pickRecycledQuestionId(onlyThisSession, 'sNow'), null)
})
