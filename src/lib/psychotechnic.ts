import 'server-only'
import { PSYCHOTECHNIC_SETS_RAW } from './psychotechnic-data'
import type { PsychotechnicSet } from './psychotechnic-grading'

export type { PsychotechnicSet }
export { gradeAnswers } from './psychotechnic-grading'

/** Public metadata only (no answer key) — safe to expose to any client component via /api/psychotechnic/sets. */
export interface PsychotechnicSetMeta {
  id: number
  name: string
  questionCount: number
}

export const PSYCHOTECHNIC_SETS: PsychotechnicSet[] = PSYCHOTECHNIC_SETS_RAW

export const PSYCHOTECHNIC_SETS_META: PsychotechnicSetMeta[] = PSYCHOTECHNIC_SETS.map(({ id, name, answers }) => ({
  id, name, questionCount: answers.length,
}))

export function getSetById(id: number): PsychotechnicSet | undefined {
  return PSYCHOTECHNIC_SETS.find(s => s.id === id)
}
