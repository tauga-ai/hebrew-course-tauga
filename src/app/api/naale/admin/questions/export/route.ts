import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireNaaleAdmin } from '@/lib/naale/auth'
import { selectAll } from '@/lib/naale/paginate'
import { buildQuestionBankWorkbook, type ExportQuestionRow, type ExportOpenQuestionRow } from '@/lib/naale/question-export'

/**
 * Downloads the current question bank as an .xlsx workbook in the exact
 * shape /api/naale/admin/questions/import expects — see question-export.ts
 * for how each sheet is built, including the reverse-transforms for the 3
 * MCQ topics whose prompt is synthesized at import time.
 */
export async function GET() {
  const admin = await requireNaaleAdmin()
  if (admin.status === 'unauthenticated') return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (admin.status === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const db = createServiceClient()
  const [mcqRows, openRows] = await Promise.all([
    selectAll<ExportQuestionRow>('naale_questions', (from, to) =>
      db.from('naale_questions').select('topic, question_id, difficulty, prompt, options, correct_answer, explanation').range(from, to)),
    selectAll<ExportOpenQuestionRow>('naale_open_questions', (from, to) =>
      db.from('naale_open_questions').select('topic, question_id, difficulty, prompt, fields').range(from, to)),
  ])

  const wb = buildQuestionBankWorkbook(mcqRows, openRows)
  const buffer = await wb.xlsx.writeBuffer()

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="naale-question-bank-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
