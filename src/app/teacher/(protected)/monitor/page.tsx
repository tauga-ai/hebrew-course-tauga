import { redirect } from 'next/navigation'
import { requireTeacher } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { getClassAndStudents } from '@/lib/teacher-data'
import { getClassroomActivitySnapshot } from '@/lib/classroom-monitor'
import { LiveMonitorBoard } from '@/components/teacher/LiveMonitorBoard'
import { t } from '@/lib/dev-i18n'

/**
 * Server Component by design (not 'use client' like every other teacher
 * page) — loads the initial snapshot fast, server-side, then hands off to
 * LiveMonitorBoard for the realtime subscription. requireTeacher() here
 * covers authorization (class_teachers/admins membership); proxy.ts only
 * ever covers "is there a session at all".
 */
export default async function TeacherMonitorPage() {
  const session = await requireTeacher()
  if (session.status !== 'ok') redirect('/teacher/login')

  const db = createServiceClient()
  const classAndStudents = await getClassAndStudents(db, session.email)
  if (!classAndStudents) {
    return <div className="p-6 text-center text-fg/60">{t('אין כיתה משויכת לחשבון זה.')}</div>
  }

  const { cls, students, lessonGroup } = classAndStudents
  const roster = students.map(s => ({ id: s.id, fullName: s.full_name, lessonGroup: s.lesson_group }))
  const initialSnapshot = await getClassroomActivitySnapshot(cls.id, roster)

  return (
    <div>
      <h1 className="text-xl font-bold text-fg mb-1">{t('ניטור בזמן אמת — תרגול בכיתה')}</h1>
      <p className="text-sm text-fg/60 mb-4">{cls.name}{lessonGroup !== null ? ` · ${t('קבוצה')} ${lessonGroup}` : ''}</p>
      <LiveMonitorBoard classId={cls.id} lessonGroup={lessonGroup} roster={roster} initialSnapshot={initialSnapshot} />
    </div>
  )
}
