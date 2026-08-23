import { test } from 'node:test'
import assert from 'node:assert/strict'
import { OPEN_GRADING_BUILDERS, publicFields } from '../src/lib/naale/open-grading-builders'
import { parseGradedResponse } from '../src/lib/naale/open-grading-parse'
import { OPEN_EXERCISE_DISPLAY } from '../src/lib/naale/open-exercise-display'

const TOPICS = Object.keys(OPEN_GRADING_BUILDERS)

test('OPEN_GRADING_BUILDERS has all 3 built AI-graded topics registered', () => {
  assert.deepEqual(new Set(TOPICS), new Set(['סיפור בהמשכים', 'ווטסאפ והודעות', 'סיכום טקסט קצר']))
})

test('registry consistency: OPEN_GRADING_BUILDERS and OPEN_EXERCISE_DISPLAY use the exact same topic keys', () => {
  // The two registries are hand-maintained separately, keyed by the same
  // Hebrew topic strings with nothing tying them together structurally — a
  // typo in one and not the other means a topic that displays but can't
  // grade, or grades but can't display.
  assert.deepEqual(new Set(Object.keys(OPEN_GRADING_BUILDERS)), new Set(Object.keys(OPEN_EXERCISE_DISPLAY)))
})

test('publicFields: only returns the keys the topic marks public', () => {
  const fields = { student_task: 'visible task', mandatory_word: 'לפתע', model_answer: 'secret' }
  assert.deepEqual(publicFields('סיפור בהמשכים', fields), { student_task: 'visible task', mandatory_word: 'לפתע' })
})

test('publicFields: a grading-only field never leaks even if present in fields', () => {
  const fields = { recipient: 'visible', expected_phrasing: 'grading-only secret' }
  const result = publicFields('ווטסאפ והודעות', fields)
  assert.equal('expected_phrasing' in result, false)
})

test('publicFields: an unregistered topic returns nothing rather than throwing', () => {
  assert.deepEqual(publicFields('נושא שלא קיים', { anything: 'x' }), {})
})

test('publicFields: a missing field key is simply omitted, not present as undefined', () => {
  const result = publicFields('סיפור בהמשכים', { student_task: 'task only' })
  assert.deepEqual(Object.keys(result), ['student_task'])
})

for (const topic of TOPICS) {
  test(`buildSystemInstruction (${topic}): interpolates prompt and fields, never takes the student's text`, () => {
    const builder = OPEN_GRADING_BUILDERS[topic]
    // Deliberately only 2 args at the type level — buildSystemInstruction has
    // no parameter for userText at all, which is the actual injection fix:
    // there is no slot for untrusted text to be interpolated into.
    assert.equal(builder.buildSystemInstruction.length, 2)

    const fields: Record<string, string> = {}
    for (const key of builder.publicFieldKeys) fields[key] = `__${key}__`
    // Also fill in any grading-only field these topics reference internally.
    fields.expected_phrasing = '__expected_phrasing__'
    fields.expected_summary = '__expected_summary__'

    const instruction = builder.buildSystemInstruction('__prompt__', fields)
    assert.match(instruction, /__prompt__/)
    for (const key of builder.publicFieldKeys) {
      assert.match(instruction, new RegExp(`__${key}__`))
    }
  })
}

test('parseGradedResponse: accepts a well-formed reply', () => {
  const result = parseGradedResponse('{"score": 4, "feedback": "טוב מאוד"}')
  assert.deepEqual(result, { score: 4, feedback: 'טוב מאוד' })
})

test('parseGradedResponse: rejects text that is not valid JSON', () => {
  assert.throws(() => parseGradedResponse('not json at all'), /not valid JSON/)
})

test('parseGradedResponse: rejects a score out of the 1-5 range', () => {
  assert.throws(() => parseGradedResponse('{"score": 7, "feedback": "x"}'), /wrong shape/)
})

test('parseGradedResponse: rejects a non-numeric score', () => {
  assert.throws(() => parseGradedResponse('{"score": "5", "feedback": "x"}'), /wrong shape/)
})

test('parseGradedResponse: rejects a missing feedback field', () => {
  assert.throws(() => parseGradedResponse('{"score": 5}'), /wrong shape/)
})

test('parseGradedResponse: rejects a non-string feedback', () => {
  assert.throws(() => parseGradedResponse('{"score": 5, "feedback": 123}'), /wrong shape/)
})
