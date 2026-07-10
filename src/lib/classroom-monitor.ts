import 'server-only'
import { createServiceClient } from './supabase/service'
import { getSetMeta } from './makbatzim'
import type { ClassroomActivityEvent } from './realtime-broadcast'

export interface RosterStudent {
  id: string
  fullName: string
  lessonGroup: number | null
}

/**
 * One-shot "current best-known state per student" snapshot across all 5
 * תרגול בכיתה features — same event shape the live broadcasts use, so the
 * client can merge them into one map without a separate code path. Powers
 * both the initial Server Component render and the reconnect catch-up
 * fetch. Deliberately excludes sentence_results: that table has no
 * timestamp column (accepted trade-off), so its rows can't be compared for
 * recency against the other three sources — a student only shows sentence
 * activity here once a live broadcast for it actually arrives.
 */
export async function getClassroomActivitySnapshot(
  classId: number,
  students: RosterStudent[]
): Promise<Record<string, ClassroomActivityEvent>> {
  const studentIds = students.map(s => s.id)
  if (studentIds.length === 0) return {}

  const nameById = new Map(students.map(s => [s.id, s.fullName]))
  const groupById = new Map(students.map(s => [s.id, s.lessonGroup]))

  const db = createServiceClient()
  const [makbatzimRes, submissionsRes, simRes] = await Promise.all([
    db.from('makbatzim_results')
      .select('student_id, set_id, question_id, is_correct, answered_at')
      .in('student_id', studentIds)
      .order('answered_at', { ascending: false }),
    db.from('submissions')
      .select('student_id, score_percentage, submitted_at, practice_sets(set_number)')
      .in('student_id', studentIds)
      .order('submitted_at', { ascending: false }),
    db.from('simulation_sessions')
      .select('*')
      .in('student_id', studentIds)
      .order('started_at', { ascending: false }),
  ])

  const latest: Record<string, ClassroomActivityEvent> = {}

  function considerCandidate(studentId: string, at: number, rest: Omit<ClassroomActivityEvent, 'studentId' | 'studentName' | 'classId' | 'lessonGroup' | 'at'>) {
    const existing = latest[studentId]
    if (existing && existing.at >= at) return
    latest[studentId] = {
      studentId,
      studentName: nameById.get(studentId) ?? '',
      classId,
      lessonGroup: groupById.get(studentId) ?? null,
      at,
      ...rest,
    }
  }

  const seenMakbatzim = new Set<string>()
  for (const row of makbatzimRes.data ?? []) {
    if (seenMakbatzim.has(row.student_id)) continue
    seenMakbatzim.add(row.student_id)
    considerCandidate(row.student_id, new Date(row.answered_at).getTime(), {
      feature: row.set_id === 'dapar-simulation' ? 'dapar-simulation' : 'makbatzim',
      label: getSetMeta(row.set_id)?.labelHe ?? row.set_id,
      status: 'in_progress',
      detail: `שאלה ${row.question_id}: ${row.is_correct ? 'נכון' : 'טעות'}`,
    })
  }

  const seenSubmissions = new Set<string>()
  for (const row of submissionsRes.data ?? []) {
    if (seenSubmissions.has(row.student_id)) continue
    seenSubmissions.add(row.student_id)
    const setNumber = (row.practice_sets as { set_number: number }[] | null)?.[0]?.set_number
    considerCandidate(row.student_id, new Date(row.submitted_at).getTime(), {
      feature: 'reading-sets',
      label: setNumber ? `סט ${setNumber}` : 'סטי הבנת הנקרא',
      status: 'completed',
      detail: `${Math.round(row.score_percentage)}%`,
    })
  }

  const seenSim = new Set<string>()
  for (const row of simRes.data ?? []) {
    if (seenSim.has(row.student_id)) continue
    seenSim.add(row.student_id)
    const at = new Date(row.completed_at ?? row.started_at).getTime()
    let label: string
    let status: ClassroomActivityEvent['status']
    let detail: string | undefined
    if (row.status === 'completed') {
      label = 'סימולציה עברית: חלק ד׳ (ראיון) — הושלמה'
      status = 'completed'
      detail = row.part_d_score != null ? `ציון ${row.part_d_score}, רמה ${row.part_d_level}` : undefined
    } else if (row.part_c_avg_score != null) {
      label = 'סימולציה עברית: חלק ג׳ (משפטים)'
      status = 'in_progress'
      detail = `ממוצע ${Number(row.part_c_avg_score).toFixed(1)}/10`
    } else if (row.part_b_correct != null) {
      label = 'סימולציה עברית: חלק ב׳'
      status = 'in_progress'
      detail = `${row.part_b_correct} נכונות`
    } else if (row.part_a_correct != null) {
      label = 'סימולציה עברית: חלק א׳'
      status = 'in_progress'
      detail = `${row.part_a_correct} נכונות`
    } else {
      label = 'סימולציה עברית'
      status = 'started'
      detail = undefined
    }
    considerCandidate(row.student_id, at, { feature: 'simulation', label, status, detail })
  }

  return latest
}
