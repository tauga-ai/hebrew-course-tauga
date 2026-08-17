import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireNaaleAdmin } from '@/lib/naale/auth'
import { importRosterFile } from '@/lib/naale/roster-import'

export async function POST(request: Request) {
  const admin = await requireNaaleAdmin()
  if (admin.status === 'unauthenticated') return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (admin.status === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const form = await request.formData()
  const file = form.get('file')
  const mode = form.get('mode')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const db = createServiceClient()
  try {
    const report = await importRosterFile(buffer, file.name, db, { dryRun: mode !== 'commit' })
    return NextResponse.json(report)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'import_failed' }, { status: 500 })
  }
}
