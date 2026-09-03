import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wordCount, wordLimitError } from '../src/lib/naale/open-exercise-display'

test('wordCount: empty string is 0', () => {
  assert.equal(wordCount(''), 0)
  assert.equal(wordCount('   '), 0)
})

test('wordCount: counts words separated by whitespace', () => {
  assert.equal(wordCount('אחת שתיים שלוש ארבע חמש'), 5)
})

test('wordCount: multiple consecutive spaces or newlines do not inflate the count', () => {
  assert.equal(wordCount('אחת   שתיים\n\nשלוש'), 3)
})

test('wordLimitError: an answer within the limit passes', () => {
  assert.equal(wordLimitError('סיפור בהמשכים', 'מילה '.repeat(10).trim()), null)
})

test('wordLimitError: an answer exactly at the limit passes', () => {
  assert.equal(wordLimitError('סיפור בהמשכים', 'מילה '.repeat(30).trim()), null)
})

test('wordLimitError: one word over the limit is rejected with the limit named', () => {
  const err = wordLimitError('סיפור בהמשכים', 'מילה '.repeat(31).trim())
  assert.notEqual(err, null)
  assert.match(err as string, /30/)
})

test('wordLimitError: an unregistered topic is never blocked', () => {
  assert.equal(wordLimitError('נושא שלא קיים', 'מילה '.repeat(500).trim()), null)
})

test('wordLimitError: picture-description allows up to 35 words', () => {
  assert.equal(wordLimitError('תיאור תמונה בקול', 'מילה '.repeat(35).trim()), null)
})

test('wordLimitError: picture-description rejects one word over 35', () => {
  const err = wordLimitError('תיאור תמונה בקול', 'מילה '.repeat(36).trim())
  assert.notEqual(err, null)
  assert.match(err as string, /35/)
})
