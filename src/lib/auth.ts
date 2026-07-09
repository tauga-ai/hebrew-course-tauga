import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { Student } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

export type StudentSessionResult =
  | { status: 'unauthenticated' }
  | { status: 'no_profile'; user: User }
  | { status: 'ok'; user: User; student: Student }

/**
 * Resolves the authenticated student from the Supabase session — server
 * routes must use this instead of trusting a student_id from the client.
 * `no_profile` means the user is authenticated but has no `students` row
 * yet (send them to /student/complete-profile).
 */
export async function getStudentFromSession(): Promise<StudentSessionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'unauthenticated' }

  const db = createServiceClient()
  const { data: student } = await db
    .from('students')
    .select('id, full_name, class_id, created_at, lesson_group')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!student) return { status: 'no_profile', user }
  return { status: 'ok', user, student }
}

export type TeacherSessionResult =
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'ok'; email: string; isAdmin: boolean }

/**
 * Resolves the authenticated teacher from the Supabase session.
 * Authorization is derived from owning a row in `class_teachers` — not a
 * client-supplied `?email=` query param, and not a separate hardcoded
 * allowlist duplicated from the client. A class can have several teachers,
 * but each teacher belongs to exactly one class. Super admins (`admins`
 * table) also pass, with `isAdmin: true` — they can view every class via a
 * selector; see getClassAndStudents() in teacher-data.ts.
 */
export async function requireTeacher(): Promise<TeacherSessionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { status: 'unauthenticated' }

  const db = createServiceClient()
  const { data: row } = await db
    .from('class_teachers')
    .select('teacher_email')
    .eq('teacher_email', user.email)
    .maybeSingle()

  if (row) return { status: 'ok', email: user.email, isAdmin: false }

  const { data: admin } = await db
    .from('admins')
    .select('email')
    .eq('email', user.email)
    .maybeSingle()

  if (!admin) return { status: 'forbidden' }
  return { status: 'ok', email: user.email, isAdmin: true }
}
