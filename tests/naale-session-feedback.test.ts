import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isFeedbackDue } from '../src/lib/naale/session-feedback'

test('isFeedbackDue: 1st completed practice session never triggers it', () => {
  const sessions = [{ kind: 'practice', completed: true }]
  assert.equal(isFeedbackDue(sessions, sessions[0], false), false)
})

test('isFeedbackDue: 2nd completed practice session triggers it', () => {
  const sessions = [{ kind: 'practice', completed: true }, { kind: 'practice', completed: true }]
  assert.equal(isFeedbackDue(sessions, sessions[1], false), true)
})

test('isFeedbackDue: 3rd completed practice session does not trigger it', () => {
  const sessions = Array.from({ length: 3 }, () => ({ kind: 'practice', completed: true }))
  assert.equal(isFeedbackDue(sessions, sessions[2], false), false)
})

test('isFeedbackDue: 4th completed practice session triggers it', () => {
  const sessions = Array.from({ length: 4 }, () => ({ kind: 'practice', completed: true }))
  assert.equal(isFeedbackDue(sessions, sessions[3], false), true)
})

test('isFeedbackDue: 5th completed practice session does not trigger it', () => {
  const sessions = Array.from({ length: 5 }, () => ({ kind: 'practice', completed: true }))
  assert.equal(isFeedbackDue(sessions, sessions[4], false), false)
})

test('isFeedbackDue: 6th completed practice session triggers it', () => {
  const sessions = Array.from({ length: 6 }, () => ({ kind: 'practice', completed: true }))
  assert.equal(isFeedbackDue(sessions, sessions[5], false), true)
})

test('isFeedbackDue: 7th completed practice session does not trigger it', () => {
  const sessions = Array.from({ length: 7 }, () => ({ kind: 'practice', completed: true }))
  assert.equal(isFeedbackDue(sessions, sessions[6], false), false)
})

test('isFeedbackDue: an incomplete session never triggers it, whatever position it would be in', () => {
  const sessions = [{ kind: 'practice', completed: true }, { kind: 'practice', completed: false }]
  assert.equal(isFeedbackDue(sessions, sessions[1], false), false)
})

test('isFeedbackDue: a placement session never triggers it, regardless of count', () => {
  const sessions = [{ kind: 'placement', completed: true }, { kind: 'placement', completed: true }]
  assert.equal(isFeedbackDue(sessions, sessions[1], false), false)
})

test('isFeedbackDue: a topic session never triggers it, regardless of count', () => {
  const sessions = [{ kind: 'topic', completed: true }, { kind: 'topic', completed: true }]
  assert.equal(isFeedbackDue(sessions, sessions[1], false), false)
})

test('isFeedbackDue: placement/topic sessions mixed in do not shift the practice count', () => {
  const sessions = [
    { kind: 'placement', completed: true },
    { kind: 'topic', completed: true },
    { kind: 'practice', completed: true },
    { kind: 'topic', completed: true },
    { kind: 'practice', completed: true },
  ]
  assert.equal(isFeedbackDue(sessions, sessions[4], false), true)
})

test('isFeedbackDue: already having a feedback row suppresses it even on the 2nd session', () => {
  const sessions = [{ kind: 'practice', completed: true }, { kind: 'practice', completed: true }]
  assert.equal(isFeedbackDue(sessions, sessions[1], true), false)
})
