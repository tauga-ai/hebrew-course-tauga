import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeAnswer } from '../src/lib/tzav-rishon-grading'
import type { TzavRishonQuestion } from '../src/data/tzav-rishon/types'
import percentagesData from '../src/data/tzav-rishon/percentages/data.json'
import averagesData from '../src/data/tzav-rishon/averages/data.json'
import motionData from '../src/data/tzav-rishon/motion/data.json'
import probabilityData from '../src/data/tzav-rishon/probability/data.json'

// Imported directly from the raw JSON (not via src/lib/tzav-rishon.ts or
// src/data/tzav-rishon/index.ts) so this test never touches the
// server-only-guarded module — that guard throws outside a Next.js server
// bundle, which includes a plain `tsx --test` run.
const TOPICS: Record<string, TzavRishonQuestion[]> = {
  percentages: percentagesData as TzavRishonQuestion[],
  averages: averagesData as TzavRishonQuestion[],
  motion: motionData as TzavRishonQuestion[],
  probability: probabilityData as TzavRishonQuestion[],
}

test('gradeAnswer: correct selection is graded correct', () => {
  const q: TzavRishonQuestion = {
    id: 1,
    question: { he: [], ar: [] },
    options: [
      { he: [], ar: [] }, { he: [], ar: [] }, { he: [], ar: [] }, { he: [], ar: [] },
    ],
    correctOption: 3,
    explanation: { he: [], ar: [] },
  }
  assert.equal(gradeAnswer(q, 3), true)
})

test('gradeAnswer: wrong selection is graded incorrect', () => {
  const q: TzavRishonQuestion = {
    id: 1,
    question: { he: [], ar: [] },
    options: [
      { he: [], ar: [] }, { he: [], ar: [] }, { he: [], ar: [] }, { he: [], ar: [] },
    ],
    correctOption: 3,
    explanation: { he: [], ar: [] },
  }
  assert.equal(gradeAnswer(q, 1), false)
})

for (const [topic, questions] of Object.entries(TOPICS)) {
  test(`${topic}: has exactly 75 questions`, () => {
    assert.equal(questions.length, 75)
  })

  test(`${topic}: every question has correctOption in 1-4`, () => {
    for (const q of questions) {
      assert.ok(q.correctOption >= 1 && q.correctOption <= 4, `q${q.id} correctOption=${q.correctOption}`)
    }
  })

  test(`${topic}: every question has exactly 4 options`, () => {
    for (const q of questions) {
      assert.equal(q.options.length, 4, `q${q.id} has ${q.options.length} options`)
    }
  })

  test(`${topic}: question ids are sequential 1-75 with no gaps or duplicates`, () => {
    const ids = questions.map(q => q.id).sort((a, b) => a - b)
    assert.deepEqual(ids, Array.from({ length: 75 }, (_, i) => i + 1))
  })

  test(`${topic}: every question has non-empty he and ar question segments`, () => {
    for (const q of questions) {
      assert.ok(q.question.he.length > 0, `q${q.id} has empty Hebrew question`)
      assert.ok(q.question.ar.length > 0, `q${q.id} has empty Arabic question`)
    }
  })
}
