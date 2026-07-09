import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTeacherReport, type TeacherReportRow, type EntityMeta } from '../src/lib/teacher-report'

const ENTITIES: EntityMeta[] = [
  { key: 'a', labelHe: 'נושא א' },
  { key: 'b', labelHe: 'נושא ב' },
]
const STUDENTS: Record<string, string> = { s1: 'תלמיד 1', s2: 'תלמיד 2' }
const correctOption = (entityId: string, questionId: number) => (entityId === 'a' && questionId === 1 ? 2 : undefined)

test('buildTeacherReport: entities_summary only includes entities with attempts', () => {
  const rows: TeacherReportRow[] = [
    { student_id: 's1', entity_id: 'a', question_id: 1, selected_option: 2, is_correct: true },
  ]
  const report = buildTeacherReport(rows, ENTITIES, STUDENTS, correctOption)
  assert.equal(report.entities_summary.length, 1)
  assert.equal(report.entities_summary[0].entity_id, 'a')
  assert.equal(report.entities_summary[0].attempted_count, 1)
  assert.equal(report.entities_summary[0].avg_pct, 100)
})

test('buildTeacherReport: students summary aggregates correct/total per student-entity pair', () => {
  const rows: TeacherReportRow[] = [
    { student_id: 's1', entity_id: 'a', question_id: 1, selected_option: 2, is_correct: true },
    { student_id: 's1', entity_id: 'a', question_id: 2, selected_option: 1, is_correct: false },
  ]
  const report = buildTeacherReport(rows, ENTITIES, STUDENTS, correctOption)
  assert.equal(report.students.length, 1)
  assert.equal(report.students[0].student_name, 'תלמיד 1')
  assert.equal(report.students[0].correct_count, 1)
  assert.equal(report.students[0].total_answered, 2)
  assert.equal(report.students[0].pct, 50)
})

test('buildTeacherReport: unknown student_id falls back to a placeholder name', () => {
  const rows: TeacherReportRow[] = [
    { student_id: 'unknown', entity_id: 'a', question_id: 1, selected_option: 2, is_correct: true },
  ]
  const report = buildTeacherReport(rows, ENTITIES, STUDENTS, correctOption)
  assert.equal(report.students[0].student_name, '—')
})

test('buildTeacherReport: question_stats is empty without an entityFilter', () => {
  const rows: TeacherReportRow[] = [
    { student_id: 's1', entity_id: 'a', question_id: 1, selected_option: 2, is_correct: true },
  ]
  const report = buildTeacherReport(rows, ENTITIES, STUDENTS, correctOption)
  assert.deepEqual(report.question_stats, [])
})

test('buildTeacherReport: question_stats computes distribution and success_pct when filtered', () => {
  const rows: TeacherReportRow[] = [
    { student_id: 's1', entity_id: 'a', question_id: 1, selected_option: 2, is_correct: true },
    { student_id: 's2', entity_id: 'a', question_id: 1, selected_option: 3, is_correct: false },
    { student_id: 's1', entity_id: 'b', question_id: 1, selected_option: 1, is_correct: true },
  ]
  const report = buildTeacherReport(rows, ENTITIES, STUDENTS, correctOption, 'a')
  assert.equal(report.question_stats.length, 1)
  const q = report.question_stats[0]
  assert.equal(q.question_id, 1)
  assert.equal(q.correct_answer, 2)
  assert.equal(q.total_answers, 2)
  assert.equal(q.correct_count, 1)
  assert.equal(q.success_pct, 50)
  assert.deepEqual(q.distribution, { 1: 0, 2: 1, 3: 1, 4: 0 })
})

test('buildTeacherReport: empty rows produce empty summaries with no crash', () => {
  const report = buildTeacherReport([], ENTITIES, STUDENTS, correctOption)
  assert.deepEqual(report.entities_summary, [])
  assert.deepEqual(report.students, [])
  assert.deepEqual(report.question_stats, [])
})
