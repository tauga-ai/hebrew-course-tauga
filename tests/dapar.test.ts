import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeDaparAnswers, DAPAR_CORRECT_ANSWERS, DAPAR_TOTAL, DAPAR_SECTIONS } from '../src/lib/dapar'

test('gradeDaparAnswers: all correct answers scores 100%', () => {
  const grade = gradeDaparAnswers([...DAPAR_CORRECT_ANSWERS])
  assert.equal(grade.totalCorrect, DAPAR_TOTAL)
  assert.equal(grade.pct, 100)
  assert.ok(grade.perSection.every(s => s.pct === 100))
})

test('gradeDaparAnswers: all wrong answers scores 0%', () => {
  // (correct % 4) + 1 always lands on a different valid answer (1-4) than `correct`
  const allWrong = DAPAR_CORRECT_ANSWERS.map(c => (c % 4) + 1)
  const grade = gradeDaparAnswers(allWrong)
  assert.equal(grade.totalCorrect, 0)
  assert.equal(grade.pct, 0)
})

test('gradeDaparAnswers: unanswered (all zeros) counts as incorrect, no crash', () => {
  const grade = gradeDaparAnswers(new Array(DAPAR_TOTAL).fill(0))
  assert.equal(grade.totalCorrect, 0)
  assert.ok(grade.perQuestion.every(q => q.selected === 0 && !q.isCorrect))
})

test('gradeDaparAnswers: empty array does not crash, treats every question as unanswered', () => {
  const grade = gradeDaparAnswers([])
  assert.equal(grade.totalCorrect, 0)
  assert.equal(grade.perQuestion.length, DAPAR_TOTAL)
  assert.ok(grade.perQuestion.every(q => q.selected === 0))
})

test('gradeDaparAnswers: perQuestion.q is 1-indexed and matches the answer key', () => {
  const grade = gradeDaparAnswers([...DAPAR_CORRECT_ANSWERS])
  assert.equal(grade.perQuestion[0].q, 1)
  assert.equal(grade.perQuestion[49].q, 50)
  assert.deepEqual(grade.perQuestion.map(q => q.correct), DAPAR_CORRECT_ANSWERS)
})

test('gradeDaparAnswers: perSection covers all 5 sections with correct labels', () => {
  const grade = gradeDaparAnswers(new Array(DAPAR_TOTAL).fill(0))
  assert.equal(grade.perSection.length, DAPAR_SECTIONS.length)
  assert.deepEqual(grade.perSection.map(s => s.label), DAPAR_SECTIONS.map(s => s.label))
})

test('gradeDaparAnswers: a single correct answer in one section only raises that section', () => {
  const answers = new Array(DAPAR_TOTAL).fill(0)
  answers[0] = DAPAR_CORRECT_ANSWERS[0] // first question, first section
  const grade = gradeDaparAnswers(answers)
  assert.equal(grade.perSection[0].correct, 1)
  assert.ok(grade.perSection.slice(1).every(s => s.correct === 0))
})
