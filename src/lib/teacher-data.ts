import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'

export interface TeacherClass {
  id: number
  name: string
  join_code: string
}

export interface ClassStudent {
  id: string
  full_name: string
  lesson_group: number | null
}

export interface ClassAndStudents {
  cls: TeacherClass
  students: ClassStudent[]
  studentIds: string[]
  /** The resolved lesson_group scope for the requesting teacher (null = whole class). */
  lessonGroup: number | null
}

interface OwnedClass {
  classId: number
  lessonGroup: number | null
}

type Db = ReturnType<typeof createServiceClient>

/** Every class `email` owns via `class_teachers`, each with its own lesson_group scope (null = whole class). */
async function ownedClasses(db: Db, email: string): Promise<OwnedClass[]> {
  const { data } = await db.from('class_teachers').select('class_id, lesson_group').eq('teacher_email', email)
  return (data || []).map(row => ({ classId: row.class_id, lessonGroup: row.lesson_group }))
}

/**
 * Resolves which class (and lesson_group scope, if any) `email` should see.
 * Admins (`admins` table) pick via the `active_class_id` cookie (set by the
 * class-selector UI), defaulting to the lowest class id, and are never
 * lesson_group-scoped. Regular teachers who own exactly one class get it
 * directly — the cookie is never consulted (today's common case, unchanged
 * behavior). Regular teachers who own more than one class (e.g. teaching
 * both Arabic and Russian) also use the `active_class_id` cookie/selector,
 * the same mechanism as admins, defaulting to their first owned class.
 */
async function resolveClassAndGroup(db: Db, email: string): Promise<OwnedClass | null> {
  const { data: admin } = await db.from('admins').select('email').eq('email', email).maybeSingle()

  if (!admin) {
    const owned = await ownedClasses(db, email)
    if (owned.length === 0) return null
    if (owned.length === 1) return owned[0]

    const cookieStore = await cookies()
    const requested = cookieStore.get('active_class_id')?.value
    if (requested) {
      const match = owned.find(o => o.classId === Number(requested))
      if (match) return match
    }
    return owned[0]
  }

  const cookieStore = await cookies()
  const requested = cookieStore.get('active_class_id')?.value
  if (requested) {
    const { data: cls } = await db.from('classes').select('id').eq('id', requested).maybeSingle()
    if (cls) return { classId: cls.id, lessonGroup: null }
  }

  const { data: first } = await db.from('classes').select('id').order('id').limit(1).maybeSingle()
  return first ? { classId: first.id, lessonGroup: null } : null
}

/**
 * Looks up the class `email` should see (their own class, or — for admins
 * or multi-class teachers — the one selected via the class selector) and
 * every student in it, scoped to their lesson_group when one is set.
 * Returns null when there's no resolvable class — callers should respond
 * 404. Students are ordered by full_name (needed by the students-list
 * page; harmless elsewhere).
 */
export async function getClassAndStudents(db: Db, email: string): Promise<ClassAndStudents | null> {
  const resolved = await resolveClassAndGroup(db, email)
  if (resolved === null) return null

  const { data: cls } = await db.from('classes').select('id, name, join_code').eq('id', resolved.classId).single()
  if (!cls) return null

  let query = db.from('students').select('id, full_name, lesson_group').eq('class_id', cls.id).order('full_name')
  if (resolved.lessonGroup !== null) query = query.eq('lesson_group', resolved.lessonGroup)
  const { data: students } = await query

  const rows = students || []
  return { cls, students: rows, studentIds: rows.map(s => s.id), lessonGroup: resolved.lessonGroup }
}

/** Every class an admin can pick from, or every class a regular teacher owns. */
export async function listClasses(db: Db, email: string, isAdmin: boolean): Promise<TeacherClass[]> {
  if (isAdmin) {
    const { data } = await db.from('classes').select('id, name, join_code').order('id')
    return data || []
  }

  const owned = await ownedClasses(db, email)
  if (owned.length === 0) return []
  const { data } = await db.from('classes').select('id, name, join_code').in('id', owned.map(o => o.classId)).order('id')
  return data || []
}
