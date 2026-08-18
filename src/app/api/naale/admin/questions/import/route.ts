import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase/service'
import { requireNaaleAdmin } from '@/lib/naale/auth'
import { runQuestionImport } from '@/lib/naale/question-import'
import { runOpenQuestionImport } from '@/lib/naale/open-question-import'

/**
 * mode: 'preview' (default) parses and validates without writing; 'commit'
 * performs the same parse and then upserts. The browser re-sends the file
 * for the commit step rather than this route caching anything between
 * requests — keeps this stateless across instances.
 */
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
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'buffer' })
  } catch {
    return NextResponse.json({ error: 'invalid_workbook' }, { status: 400 })
  }

  const db = createServiceClient()
  try {
    // Both content kinds live in the same workbook — one upload covers both,
    // rather than asking the admin to upload the same file twice.
    const [mcqReport, openReport] = await Promise.all([
      runQuestionImport(wb, db, { dryRun: mode !== 'commit' }),
      runOpenQuestionImport(wb, db, { dryRun: mode !== 'commit' }),
    ])
    return NextResponse.json({ mcq: mcqReport, open: openReport })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'import_failed' }, { status: 500 })
  }
}
