import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { listClasses } from '@/lib/teacher-data'
import { requireTeacher } from '@/lib/auth'

/**
 * Lists the classes the authenticated teacher can view — every class for an
 * admin (powers the class selector), or the single class a regular teacher
 * owns. Used by the shared teacher layout.
 */
export async function GET() {
  const teacher = await requireTeacher()
  if (teacher.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const db = createServiceClient()
  const classes = await listClasses(db, teacher.email, teacher.isAdmin)

  return NextResponse.json({ classes, isAdmin: teacher.isAdmin })
}
