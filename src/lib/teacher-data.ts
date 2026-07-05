import { cookies } from 'next/headers'
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

type Db = ReturnType<typeof createServiceClient>

/** The one class `email` owns via `class_teachers`, or null if none. */
async function ownedClassId(db: Db, email: string): Promise<number | null> {
  const { data: link } = await db.from('class_teachers').select('class_id').eq('teacher_email', email).maybeSingle()
  return link?.class_id ?? null
}

/**
 * Resolves which class `email` should see. Regular teachers always get their
 * own class (via `class_teachers`) — the cookie is never consulted on this
 * path, so it can't be used to view another class. Admins (`admins` table)
 * get whichever class is selected via the `active_class_id` cookie (set by
 * the class-selector UI), defaulting to the lowest class id.
 */
async function resolveClassId(db: Db, email: string): Promise<number | null> {
  const { data: admin } = await db.from('admins').select('email').eq('email', email).maybeSingle()
  if (!admin) return ownedClassId(db, email)

  const cookieStore = await cookies()
  const requested = cookieStore.get('active_class_id')?.value
  if (requested) {
    const { data: cls } = await db.from('classes').select('id').eq('id', requested).maybeSingle()
    if (cls) return cls.id
  }

  const { data: first } = await db.from('classes').select('id').order('id').limit(1).maybeSingle()
  return first?.id ?? null
}

/**
 * Looks up the class `email` should see (their own class, or — for admins —
 * the one selected via the class selector) and every student in it. Returns
 * null when there's no resolvable class — callers should respond 404.
 * Students are ordered by full_name (needed by the students-list page; harmless elsewhere).
 */
export async function getClassAndStudents(db: Db, email: string): Promise<ClassAndStudents | null> {
  const classId = await resolveClassId(db, email)
  if (classId === null) return null

  const { data: cls } = await db.from('classes').select('id, name, join_code').eq('id', classId).single()
  if (!cls) return null

  const { data: students } = await db
    .from('students')
    .select('id, full_name')
    .eq('class_id', cls.id)
    .order('full_name')

  const rows = students || []
  return { cls, students: rows, studentIds: rows.map(s => s.id) }
}

/** Every class an admin can pick from, or the single class a regular teacher owns. */
export async function listClasses(db: Db, email: string, isAdmin: boolean): Promise<TeacherClass[]> {
  if (isAdmin) {
    const { data } = await db.from('classes').select('id, name, join_code').order('id')
    return data || []
  }

  const classId = await ownedClassId(db, email)
  if (classId === null) return []
  const { data: cls } = await db.from('classes').select('id, name, join_code').eq('id', classId).maybeSingle()
  return cls ? [cls] : []
}
