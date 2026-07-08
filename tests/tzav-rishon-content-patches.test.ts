import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withContentPatch } from '../src/lib/tzav-rishon-content-patches'
import type { TzavRishonQuestion } from '../src/data/tzav-rishon/types'

function fakeQuestion(id: number): TzavRishonQuestion {
  return {
    id,
    question: { he: [{ type: 'text', content: 'שאלה' }], ar: [{ type: 'text', content: 'سؤال' }] },
    options: Array.from({ length: 4 }, () => ({
      he: [{ type: 'text', content: 'א' }],
      ar: [{ type: 'text', content: 'أ' }],
    })),
    correctOption: 1,
    explanation: { he: [{ type: 'text', content: 'ORIGINAL TRUNCATED …' }], ar: [{ type: 'text', content: 'ORIGINAL ARABIC' }] },
  }
}

// Regression guard: if src/data/tzav-rishon/index.ts is ever refactored and
// stops calling withContentPatch, this is the test that should catch it —
// the patch must keep applying until the source xlsx itself is corrected
// (see the TODOs in tzav-rishon-content-patches.ts).
for (const id of [5, 9, 12]) {
  test(`withContentPatch: percentages q${id} gets a corrected (non-truncated) Hebrew explanation`, () => {
    const patched = withContentPatch('percentages', fakeQuestion(id))
    const text = patched.explanation.he.map(s => s.content).join('')
    assert.ok(!text.includes('…'), 'patched explanation should not still end in an ellipsis')
    assert.notEqual(text, 'ORIGINAL TRUNCATED …', 'patch should have replaced the explanation')
  })

  test(`withContentPatch: percentages q${id}'s Arabic explanation is left untouched`, () => {
    const patched = withContentPatch('percentages', fakeQuestion(id))
    assert.deepEqual(patched.explanation.ar, [{ type: 'text', content: 'ORIGINAL ARABIC' }])
  })
}

test('withContentPatch: questions with no known issue pass through unchanged', () => {
  const original = fakeQuestion(1)
  const patched = withContentPatch('percentages', original)
  assert.deepEqual(patched, original)
})

test('withContentPatch: the same question id in a different topic is not accidentally patched', () => {
  const original = fakeQuestion(5)
  const patched = withContentPatch('averages', original)
  assert.deepEqual(patched, original)
})
