import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAnswer, isAnswerCorrect } from '../src/lib/naale/grading'

test('normalizeAnswer: trims and collapses whitespace', () => {
  assert.equal(normalizeAnswer('  שלום   עולם  '), normalizeAnswer('שלום עולם'))
})

test('normalizeAnswer: strips trailing punctuation only', () => {
  assert.equal(normalizeAnswer('תשובה.'), normalizeAnswer('תשובה'))
  // Internal punctuation is preserved — it can be meaningful.
  assert.notEqual(normalizeAnswer('א,ב'), normalizeAnswer('אב'))
})

test('isAnswerCorrect: accepts an answer differing only by surrounding space', () => {
  assert.equal(isAnswerCorrect(' תשובה ', 'תשובה', 'text'), true)
})

test('isAnswerCorrect: rejects a genuinely different answer', () => {
  assert.equal(isAnswerCorrect('תשובה אחרת', 'תשובה', 'text'), false)
})

test('isAnswerCorrect: mcq option strings match exactly after normalization', () => {
  assert.equal(isAnswerCorrect('אופציה 2', 'אופציה 2', 'mcq'), true)
  assert.equal(isAnswerCorrect('אופציה 1', 'אופציה 2', 'mcq'), false)
})
