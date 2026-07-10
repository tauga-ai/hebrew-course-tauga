import { createServiceClient } from './supabase/service'

export type ClassroomFeature = 'simulation' | 'dapar-simulation' | 'sentence' | 'reading-sets' | 'makbatzim'

export interface ClassroomActivityEvent {
  studentId: string
  studentName: string
  classId: number
  lessonGroup: number | null
  feature: ClassroomFeature
  /** Human-readable label for what was worked on, e.g. a set name or part name. */
  label: string
  status: 'started' | 'in_progress' | 'completed'
  /** Free-form, feature-specific detail string, e.g. "3/10 נכונות" or "ציון 87%". */
  detail?: string
  at: number
}

/**
 * Fire-and-forget push of one classroom-practice activity event to any
 * teacher currently watching this class/group live. Always broadcasts to the
 * whole-class channel (admins and null-lesson_group teachers), and — only
 * when the student actually has a lesson_group — also to that group's own
 * channel, mirroring exactly how getClassAndStudents() scopes reads today.
 * Never awaited by callers: a broadcast failure must never affect the
 * student-facing save it rides along with.
 */
export function broadcastClassroomActivity(event: ClassroomActivityEvent): void {
  const db = createServiceClient()
  const payload = { studentId: event.studentId, studentName: event.studentName, feature: event.feature, label: event.label, status: event.status, detail: event.detail, at: event.at }

  db.channel(`class:${event.classId}:all`).httpSend('activity', payload).catch(() => {})

  if (event.lessonGroup !== null) {
    db.channel(`class:${event.classId}:group:${event.lessonGroup}`).httpSend('activity', payload).catch(() => {})
  }
}
