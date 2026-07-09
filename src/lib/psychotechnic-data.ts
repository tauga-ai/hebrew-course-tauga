import type { PsychotechnicSet } from './psychotechnic-grading'

/**
 * The raw answer key. Not itself server-only (mirrors tzav-rishon's raw
 * JSON data files, which are also technically importable directly) — the
 * real enforcement point is psychotechnic.ts, which is server-only and is
 * the only module app code should ever import this from. Kept separate so
 * tests/psychotechnic.test.ts can import it directly without going through
 * that guard (a plain `tsx --test` run has no way to distinguish "server"
 * from "client" context, so server-only always throws outside Next's build).
 */
// Correct answers from the answer key PDF
// answers[i] = correct answer for question (i+1)
export const PSYCHOTECHNIC_SETS_RAW: PsychotechnicSet[] = [
  {
    id: 1,
    name: 'מקבץ 1',
    answers: [2, 3, 4, 4, 4, 3, 4, 4, 1],           // 9 questions
  },
  {
    id: 2,
    name: 'מקבץ 2',
    answers: [1, 4, 4, 3, 4, 1, 2, 2, 3, 2],         // 10 questions
  },
  {
    id: 3,
    name: 'מקבץ 3',
    answers: [2, 3, 2, 4, 3, 3, 1, 3, 1, 2],         // 10 questions
  },
  {
    id: 4,
    name: 'מקבץ 4',
    answers: [4, 4, 1, 2, 4, 3, 2, 2, 4, 3],         // 10 questions
  },
  {
    id: 5,
    name: 'מקבץ 5',
    answers: [1, 2, 3, 2, 3, 3, 4, 1, 3, 4],         // 10 questions
  },
  {
    id: 6,
    name: 'מקבץ 6',
    answers: [2, 1, 3, 2, 4, 1, 3, 1, 4, 4],         // 10 questions
  },
  {
    id: 7,
    name: 'מקבץ 7',
    answers: [1, 4, 2, 3, 2, 2, 1, 1, 4, 3],         // 10 questions
  },
  {
    id: 8,
    name: 'אנלוגיות מילוליות — מקבץ 1',
    answers: [4, 3, 4, 4, 3, 3, 4, 3, 1, 3],         // 10 questions
  },
  {
    id: 9,
    name: 'אנלוגיות מילוליות — מקבץ 2',
    answers: [1, 3, 2, 2, 2, 4, 2, 3, 3, 3],         // 10 questions
  },
  {
    id: 10,
    name: 'אנלוגיות צורניות — מקבץ 1',
    answers: [1, 2, 4, 4, 1, 3, 2, 3, 1, 4],         // 10 questions
  },
]
