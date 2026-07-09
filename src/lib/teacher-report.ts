export interface TeacherReportRow {
  student_id: string
  entity_id: string
  question_id: number
  selected_option: number
  is_correct: boolean
}

export interface EntityMeta {
  key: string
  labelHe: string
}

export interface TeacherReport {
  entities_summary: { entity_id: string; label_he: string; attempted_count: number; avg_pct: number | null }[]
  students: { student_id: string; student_name: string; entity_id: string; label_he: string; correct_count: number; total_answered: number; pct: number }[]
  question_stats: {
    question_id: number
    correct_answer: number
    total_answers: number
    correct_count: number
    success_pct: number | null
    distribution: Record<number, number>
  }[]
}

/**
 * Pure aggregation shared by the tzav-rishon and makbatzim teacher report
 * routes — identical logic in both, differing only in column/label names
 * (topic vs set_id), which callers normalize into `entity_id`/`label_he`
 * before calling this.
 */
export function buildTeacherReport(
  rows: TeacherReportRow[],
  entities: EntityMeta[],
  studentMap: Record<string, string>,
  getCorrectOption: (entityId: string, questionId: number) => number | undefined,
  entityFilter?: string
): TeacherReport {
  // Entities summary: activity + accuracy per entity, across the whole class.
  const entitiesSummary = entities.map(e => {
    const entityRows = rows.filter(r => r.entity_id === e.key)
    return {
      entity_id: e.key,
      label_he: e.labelHe,
      attempted_count: entityRows.length,
      avg_pct: entityRows.length > 0
        ? Math.round((entityRows.filter(r => r.is_correct).length / entityRows.length) * 100)
        : null,
    }
  }).filter(e => e.attempted_count > 0)

  // Per-student-per-entity summary (not raw per-question rows).
  const entityByKey = new Map(entities.map(e => [e.key, e.labelHe]))
  const studentEntityKey = (studentId: string, entityId: string) => `${studentId}::${entityId}`
  const studentEntityMap = new Map<string, { correct: number; total: number }>()
  for (const r of rows) {
    const key = studentEntityKey(r.student_id, r.entity_id)
    const entry = studentEntityMap.get(key) || { correct: 0, total: 0 }
    entry.total++
    if (r.is_correct) entry.correct++
    studentEntityMap.set(key, entry)
  }
  const students = Array.from(studentEntityMap.entries()).map(([key, { correct, total }]) => {
    const [studentId, entityId] = key.split('::')
    return {
      student_id: studentId,
      student_name: studentMap[studentId] || '—',
      entity_id: entityId,
      label_he: entityByKey.get(entityId) || entityId,
      correct_count: correct,
      total_answered: total,
      pct: Math.round((correct / total) * 100),
    }
  })

  // Per-question distribution, only computed for a specific entity (avoids
  // mixing question numbers across entities, which would be meaningless).
  let questionStats: TeacherReport['question_stats'] = []
  if (entityFilter) {
    const byQuestion = new Map<number, TeacherReportRow[]>()
    for (const r of rows) {
      if (r.entity_id !== entityFilter) continue
      const list = byQuestion.get(r.question_id) || []
      list.push(r)
      byQuestion.set(r.question_id, list)
    }
    questionStats = Array.from(byQuestion.entries()).map(([questionId, qRows]) => {
      const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      let correctCount = 0
      for (const r of qRows) {
        if (r.selected_option >= 1 && r.selected_option <= 4) dist[r.selected_option]++
        if (r.is_correct) correctCount++
      }
      return {
        question_id: questionId,
        correct_answer: getCorrectOption(entityFilter, questionId) ?? 0,
        total_answers: qRows.length,
        correct_count: correctCount,
        success_pct: qRows.length > 0 ? Math.round((correctCount / qRows.length) * 100) : null,
        distribution: dist,
      }
    }).sort((a, b) => a.question_id - b.question_id)
  }

  return { entities_summary: entitiesSummary, students, question_stats: questionStats }
}
