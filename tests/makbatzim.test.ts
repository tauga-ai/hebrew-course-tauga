import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeAnswer } from '../src/lib/makbatzim-grading'
import type { MakbatzimQuestion } from '../src/data/makbatzim/types'
import set1Data from '../src/data/makbatzim/set-1/data.json'
import set2Data from '../src/data/makbatzim/set-2/data.json'
import set3Data from '../src/data/makbatzim/set-3/data.json'
import set4Data from '../src/data/makbatzim/set-4/data.json'
import set1TzuraniData from '../src/data/makbatzim/set-1-tzurani/data.json'
import set1AnalogiesData from '../src/data/makbatzim/set-1-analogies/data.json'
import set1InstructionsData from '../src/data/makbatzim/set-1-instructions/data.json'
import daparSimulationData from '../src/data/makbatzim/dapar-simulation/data.json'

// Imported directly from the raw JSON (not via src/lib/makbatzim.ts or
// src/data/makbatzim/index.ts) so this test never touches the
// server-only-guarded module — that guard throws outside a Next.js server
// bundle, which includes a plain `tsx --test` run.
const SETS: Record<string, MakbatzimQuestion[]> = {
  'set-1': set1Data as MakbatzimQuestion[],
  'set-2': set2Data as MakbatzimQuestion[],
  'set-3': set3Data as MakbatzimQuestion[],
  'set-4': set4Data as MakbatzimQuestion[],
  'set-1-tzurani': set1TzuraniData as MakbatzimQuestion[],
  'set-1-analogies': set1AnalogiesData as MakbatzimQuestion[],
  'set-1-instructions': set1InstructionsData as MakbatzimQuestion[],
  'dapar-simulation': daparSimulationData as MakbatzimQuestion[],
}

const EXPECTED_COUNT: Record<string, number> = {
  'set-1': 9,
  'set-2': 10,
  'set-3': 10,
  'set-4': 10,
  'set-1-tzurani': 9,
  'set-1-analogies': 9,
  'set-1-instructions': 10,
  'dapar-simulation': 40,
}

const EXPECTED_IMAGE_COUNT: Record<string, number> = {
  'set-1': 0,
  'set-2': 0,
  'set-3': 0,
  'set-4': 0,
  'set-1-tzurani': 9,
  'set-1-analogies': 0,
  'set-1-instructions': 0,
  // Updated 2026-07-10 alongside the refreshed 40-question source workbook
  // (was 13 with the previous question set).
  'dapar-simulation': 12,
}

test('gradeAnswer: correct selection is graded correct', () => {
  const q: MakbatzimQuestion = { id: 1, question: [], options: [[], [], [], []], correctOption: 3, explanation: [] }
  assert.equal(gradeAnswer(q, 3), true)
})

test('gradeAnswer: wrong selection is graded incorrect', () => {
  const q: MakbatzimQuestion = { id: 1, question: [], options: [[], [], [], []], correctOption: 3, explanation: [] }
  assert.equal(gradeAnswer(q, 1), false)
})

for (const [setId, questions] of Object.entries(SETS)) {
  test(`${setId}: has exactly ${EXPECTED_COUNT[setId]} questions`, () => {
    assert.equal(questions.length, EXPECTED_COUNT[setId])
  })

  test(`${setId}: every question has correctOption in 1-4`, () => {
    for (const q of questions) {
      assert.ok(q.correctOption >= 1 && q.correctOption <= 4, `q${q.id} correctOption=${q.correctOption}`)
    }
  })

  test(`${setId}: every question has exactly 4 options`, () => {
    for (const q of questions) {
      assert.equal(q.options.length, 4, `q${q.id} has ${q.options.length} options`)
    }
  })

  test(`${setId}: question ids are sequential with no gaps or duplicates`, () => {
    const ids = questions.map(q => q.id).sort((a, b) => a - b)
    assert.deepEqual(ids, Array.from({ length: EXPECTED_COUNT[setId] }, (_, i) => i + 1))
  })

  test(`${setId}: every question has non-empty question segments`, () => {
    for (const q of questions) {
      assert.ok(q.question.length > 0, `q${q.id} has empty question`)
    }
  })

  test(`${setId}: has exactly ${EXPECTED_IMAGE_COUNT[setId]} questions with an imageUrl`, () => {
    const withImages = questions.filter(q => q.imageUrl).length
    assert.equal(withImages, EXPECTED_IMAGE_COUNT[setId])
  })
}
