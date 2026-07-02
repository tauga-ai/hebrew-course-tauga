import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeAnswers, getSetById, PSYCHOTECHNIC_SETS } from '../src/lib/psychotechnic'

test('gradeAnswers: all correct answers scores full marks', () => {
  const set = PSYCHOTECHNIC_SETS[0]
  const grade = gradeAnswers(set, [...set.answers])
  assert.equal(grade.score, set.answers.length)
  assert.equal(grade.total, set.answers.length)
  assert.ok(grade.results.every(r => r.isCorrect))
})

test('gradeAnswers: empty studentAnswers scores 0, does not crash', () => {
  const set = PSYCHOTECHNIC_SETS[0]
  const grade = gradeAnswers(set, [])
  assert.equal(grade.score, 0)
  assert.ok(grade.results.every(r => r.student === 0 && !r.isCorrect))
})

test('gradeAnswers: results.q is 1-indexed and correct mirrors the set answer key', () => {
  const set = PSYCHOTECHNIC_SETS[1]
  const grade = gradeAnswers(set, new Array(set.answers.length).fill(0))
  assert.equal(grade.results[0].q, 1)
  assert.deepEqual(grade.results.map(r => r.correct), set.answers)
})

test('gradeAnswers: partial correctness is counted precisely', () => {
  const set = PSYCHOTECHNIC_SETS[0]
  const studentAnswers = [...set.answers]
  studentAnswers[0] = studentAnswers[0] === 1 ? 2 : 1 // force question 1 wrong
  const grade = gradeAnswers(set, studentAnswers)
  assert.equal(grade.score, set.answers.length - 1)
  assert.equal(grade.results[0].isCorrect, false)
})

test('getSetById: returns the matching set for a valid id', () => {
  const set = getSetById(1)
  assert.equal(set?.id, 1)
  assert.equal(set?.name, 'מקבץ 1')
})

test('getSetById: returns undefined for an unknown id', () => {
  assert.equal(getSetById(9999), undefined)
})

test('PSYCHOTECHNIC_SETS: every set has a non-empty answers array with values 1-4', () => {
  for (const set of PSYCHOTECHNIC_SETS) {
    assert.ok(set.answers.length > 0, `set ${set.id} has no answers`)
    assert.ok(set.answers.every(a => a >= 1 && a <= 4), `set ${set.id} has an out-of-range answer`)
  }
})
