import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { getClassAndStudents } from '@/lib/teacher-data'
import { getClassroomActivitySnapshot } from '@/lib/classroom-monitor'

/**
 * Wraps getClassroomActivitySnapshot() for LiveMonitorBoard's client-side
 * catch-up fetch — called whenever its realtime channel (re)subscribes,
 * since broadcasts missed while disconnected are never replayed. Same
 * scoping (requireTeacher + getClassAndStudents) as the initial
 * Server Component render in /teacher/monitor.
 */
export async function GET() {
  const session = await requireTeacher()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const classAndStudents = await getClassAndStudents(db, session.email)
  if (!classAndStudents) return NextResponse.json({ error: 'no class' }, { status: 404 })

  const { cls, students } = classAndStudents
  const roster = students.map(s => ({ id: s.id, fullName: s.full_name, lessonGroup: s.lesson_group }))
  const snapshot = await getClassroomActivitySnapshot(cls.id, roster)

  return NextResponse.json({ snapshot })
}
