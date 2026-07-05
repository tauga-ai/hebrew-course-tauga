import { createServiceClient } from '@/lib/supabase'

export interface TeacherClass {
  id: number
  name: string
  join_code: string
}

export interface ClassStudent {
  id: string
  full_name: string
}

export interface ClassAndStudents {
  cls: TeacherClass
  students: ClassStudent[]
  studentIds: string[]
}

/**
 * Looks up the class `email` teaches (via `class_teachers`) and every
 * student in it. Returns null when the teacher owns no class — callers
 * should respond 404 in that case.
 * Students are ordered by full_name (needed by the students-list page; harmless elsewhere).
 */
export async function getClassAndStudents(
  db: ReturnType<typeof createServiceClient>,
  email: string
): Promise<ClassAndStudents | null> {
  const { data: link } = await db.from('class_teachers').select('class_id').eq('teacher_email', email).maybeSingle()
  if (!link) return null

  const { data: cls } = await db.from('classes').select('id, name, join_code').eq('id', link.class_id).single()
  if (!cls) return null

  const { data: students } = await db
    .from('students')
    .select('id, full_name')
    .eq('class_id', cls.id)
    .order('full_name')

  const rows = students || []
  return { cls, students: rows, studentIds: rows.map(s => s.id) }
}
