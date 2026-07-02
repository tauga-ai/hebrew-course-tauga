import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSimulationQuestions,
  MANDATORY_QUESTIONS,
  ALL_PRACTICE_QUESTIONS,
  SIMULATION_INTERVIEW_QUESTIONS,
} from '../src/lib/interview-questions'

test('buildSimulationQuestions: always returns 15 questions (6 mandatory + 9 random)', () => {
  for (let i = 0; i < 30; i++) {
    assert.equal(buildSimulationQuestions().length, 15)
  }
})

test('buildSimulationQuestions: the first 6 questions are always MANDATORY_QUESTIONS, in order', () => {
  const qs = buildSimulationQuestions()
  assert.deepEqual(qs.slice(0, 6).map(q => q.id), MANDATORY_QUESTIONS.map(q => q.id))
})

test('buildSimulationQuestions: never returns duplicate questions', () => {
  for (let i = 0; i < 30; i++) {
    const ids = buildSimulationQuestions().map(q => q.id)
    assert.equal(new Set(ids).size, ids.length)
  }
})

test('buildSimulationQuestions: the random 9 vary across calls (not the same every time)', () => {
  const runs = new Set()
  for (let i = 0; i < 20; i++) {
    runs.add(JSON.stringify(buildSimulationQuestions().slice(6).map(q => q.id)))
  }
  assert.ok(runs.size > 1, 'expected different random selections across 20 runs')
})

test('ALL_PRACTICE_QUESTIONS: has no duplicate ids', () => {
  const ids = ALL_PRACTICE_QUESTIONS.map(q => q.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('SIMULATION_INTERVIEW_QUESTIONS: has exactly 16 fixed questions', () => {
  assert.equal(SIMULATION_INTERVIEW_QUESTIONS.length, 16)
  assert.ok(SIMULATION_INTERVIEW_QUESTIONS.every(q => typeof q === 'string' && q.length > 0))
})
