import { test } from 'node:test'
import assert from 'node:assert/strict'
import { looksTruncated } from '../src/lib/naale/debate-grading-validate'

// Regression coverage for a real bug found during live QA (naale-debate-module,
// 2026-09-16): Gemini's final-turn feedback came back as valid, well-formed
// JSON, but the feedback STRING inside it was cut off mid-sentence —
// 'מצוין! הביע דעה ברורה (' with no closing paren — and got saved/shown as-is.

test('looksTruncated: the exact truncated string found live is flagged', () => {
  assert.equal(looksTruncated('מצוין! הביע דעה ברורה ('), true)
})

test('looksTruncated: a normal finished sentence with balanced parens is not flagged', () => {
  assert.equal(
    looksTruncated('כל הכבוד! ענית לעניין, הבעת דעה ברורה ונימקת אותה בהיגיון פשוט (יפה מאוד).'),
    false
  )
})

test('looksTruncated: a normal finished sentence with no parens at all is not flagged', () => {
  assert.equal(looksTruncated('הטיעון שלך ברור והגיוני.'), false)
})

test('looksTruncated: an empty or whitespace-only string is flagged', () => {
  assert.equal(looksTruncated(''), true)
  assert.equal(looksTruncated('   '), true)
})

test('looksTruncated: a mid-word cutoff with no open bracket at all is not caught by this heuristic', () => {
  // Documents the known limitation, rather than pretending this catches every
  // possible truncation — only the unmatched-bracket case is checked, since
  // it's the lowest-false-positive signal available without a real NLP check.
  assert.equal(looksTruncated('הטיעון שלך מצוין ומאוד מפור'), false)
})
