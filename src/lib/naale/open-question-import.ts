/**
 * Parsing, validation, and upsert logic for the free-text, AI-graded Naale
 * exercises (Story Continuation, WhatsApp, Text Summary, and later the
 * picture-description exercise) — mirrors question-import.ts's shape for the
 * multiple-choice sheets, but starts with zero registered sheets. Each
 * content ticket adds its own reader to OPEN_SHEET_READERS.
 */
import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'

// Each content ticket's sheet reader imports buildColumnMap directly from
// ./question-import (exported there for exactly this reuse) — not
// re-exported here, to keep one canonical import path.
export const HEADER_ROW_INDEX = 2

export interface OpenQuestionRow {
  topic: string
  difficulty: number
  prompt: string
  fields: Record<string, string>
  source_row: number
}

/** Populated by each content ticket — empty until naale-story-continuation /
 *  naale-whatsapp-messages / naale-text-summary register their own reader. */
export const OPEN_SHEET_READERS: Record<string, (wb: XLSX.WorkBook, sheetName: string) => OpenQuestionRow[]> = {}

export interface OpenQuestionImportReport {
  summary: { topic: string; count: number; byLevel: Record<number, number> }[]
  anomalies: string[]
  skippedSheets: string[]
  orphans: { topic: string; prompt: string }[]
  totalRows: number
  written: boolean
}

/**
 * Parses, validates, and (unless dryRun) upserts every registered sheet from
 * `wb`. Shared by scripts/import-naale-questions.ts (CLI) and
 * /api/naale/admin/questions/import (web upload), alongside runQuestionImport()
 * for the MCQ sheets, so a single workbook upload covers both content kinds.
 */
export async function runOpenQuestionImport(
  wb: XLSX.WorkBook,
  db: SupabaseClient,
  opts: { dryRun: boolean }
): Promise<OpenQuestionImportReport> {
  const anomalies: string[] = []
  const summary: OpenQuestionImportReport['summary'] = []
  const allRows: OpenQuestionRow[] = []

  for (const [sheetName, readSheet] of Object.entries(OPEN_SHEET_READERS)) {
    if (!wb.Sheets[sheetName]) {
      anomalies.push(`Sheet not found in workbook: ${sheetName}`)
      continue
    }
    // Same reasoning as runQuestionImport(): one sheet's structural problem
    // must not take down the whole import.
    let questions: OpenQuestionRow[]
    try {
      questions = readSheet(wb, sheetName)
    } catch (e) {
      anomalies.push(e instanceof Error ? e.message : `${sheetName}: failed to parse (unknown error)`)
      continue
    }
    if (questions.length === 0) anomalies.push(`${sheetName}: no question rows found`)
    allRows.push(...questions)

    const byLevel: Record<number, number> = {}
    for (let l = 1; l <= 5; l++) byLevel[l] = questions.filter(q => q.difficulty === l).length
    summary.push({ topic: sheetName, count: questions.length, byLevel })
  }

  const expectedSheets = Object.keys(OPEN_SHEET_READERS)
  const skippedSheets = wb.SheetNames.filter(n => !expectedSheets.includes(n))

  let written = false
  if (!opts.dryRun && allRows.length > 0) {
    const { error } = await db.from('naale_open_questions').upsert(allRows, { onConflict: 'topic,prompt' })
    if (error) throw new Error(`upsert failed — ${error.message}`)
    written = true
  }

  // Reported, never deleted — same convention as runQuestionImport().
  const { data: existing } = await db
    .from('naale_open_questions')
    .select('topic, prompt')
    .in('topic', expectedSheets)
  const workbookKeys = new Set(allRows.map(r => `${r.topic} ${r.prompt}`))
  const orphans = (existing ?? [])
    .filter(r => !workbookKeys.has(`${r.topic} ${r.prompt}`))
    .map(r => ({ topic: r.topic, prompt: r.prompt }))

  return { summary, anomalies, skippedSheets, orphans, totalRows: allRows.length, written }
}
